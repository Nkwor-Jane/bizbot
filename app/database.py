from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
from typing import Generator
import os
import json
from dotenv import load_dotenv

load_dotenv()
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    echo=True,
    connect_args={"sslmode": "require"} 
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Database models
class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, nullable=True) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship
    messages = relationship("Message", back_populates="session")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.session_id"), nullable=False)
    user_message = Column(Text, nullable=False)
    bot_response = Column(Text, nullable=False)
    message_type = Column(String, default="chat") 
    confidence_score = Column(String, nullable=True)  
    sources_used = Column(Text, nullable=True)  
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    session = relationship("ChatSession", back_populates="messages")

class UserFeedback(Base):
    __tablename__ = "user_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.session_id"))
    message_id = Column(Integer, ForeignKey("messages.id"))
    feedback_type = Column(String)  # thumbs_up, thumbs_down, report
    feedback_text = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

# Database Operations Class
class ChatDatabase:
    def __init__(self):
        self.SessionLocal = SessionLocal
    
    def create_tables(self):
        """Create all tables - run this once"""
        Base.metadata.create_all(bind=engine)

    def _serialize_sources(self, sources):
        """Convert sources to JSON string safely"""
        if sources is None:
            return None
        
        # Handle different input types
        if isinstance(sources, str):
            try:
                # If it's already a JSON string, validate it
                json.loads(sources)
                return sources
            except json.JSONDecodeError:
                # If it's a plain string, wrap it in a list
                return json.dumps([sources])
        
        elif isinstance(sources, list):
            # Clean up the sources list to ensure JSON serializability
            clean_sources = []
            for source in sources:
                if isinstance(source, dict):
                    clean_sources.append(source)
                elif isinstance(source, str):
                    clean_sources.append({"source": source})
                else:
                    clean_sources.append({"source": str(source)})
            return json.dumps(clean_sources)
        
        elif isinstance(sources, dict):
            return json.dumps([sources])
        
        else:
            # Fallback for any other type
            return json.dumps([{"source": str(sources)}])
    
    def _deserialize_sources(self, sources_json):
        """Convert JSON string back to Python object safely"""
        if sources_json is None:
            return []
        
        try:
            return json.loads(sources_json)
        except json.JSONDecodeError:
            # Fallback to empty list if JSON is invalid
            return []
    
    def save_conversation(self, session_id: str, user_message: str, bot_response: str, 
                         confidence_score: str = None, sources_used = None):
        """Save a conversation to the database"""
        db = self.SessionLocal()
        try:
            # Create session if doesn't exist
            session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
            if not session:
                session = ChatSession(session_id=session_id)
                db.add(session)
                db.commit()
            
            # Serialize sources to JSON
            sources_json = self._serialize_sources(sources_used)
            

            # Save message
            message = Message(
                session_id=session_id,
                user_message=user_message,
                bot_response=bot_response,
                # confidence_score=confidence_score,
                confidence_score=str(confidence_score) if confidence_score is not None else None,
                sources_used=sources_json
            )
            db.add(message)
            db.commit()
            
            return message.id
        
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
    
    def get_chat_history(self, session_id: str, limit: int = 10):
        """Get chat history for a session"""
        db = self.SessionLocal()
        try:
            messages = db.query(Message).filter(
                Message.session_id == session_id
            ).order_by(Message.timestamp.desc()).limit(limit).all()
            
            return [
                {
                    "user_message": msg.user_message,
                    "bot_response": msg.bot_response,
                    "timestamp": msg.timestamp.isoformat(),
                    "confidence_score": msg.confidence_score,
                    "sources_used": self._deserialize_sources(msg.sources_used)
                }
                for msg in reversed(messages) 
            ]
        finally:
            db.close()
    
    def save_feedback(self, session_id: str, message_id: int, feedback_type: str, feedback_text: str = None):
        """Save user feedback"""
        db = self.SessionLocal()
        try:
            feedback = UserFeedback(
                session_id=session_id,
                message_id=message_id,
                feedback_type=feedback_type,
                feedback_text=feedback_text
            )
            db.add(feedback)
            db.commit()
            return feedback.id
        finally:
            db.close()
    
    def get_session_stats(self, session_id: str):
        """Get stats for a session"""
        db = self.SessionLocal()
        try:
            message_count = db.query(Message).filter(Message.session_id == session_id).count()
            session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
            
            return {
                "message_count": message_count,
                "session_created": session.created_at.isoformat() if session else None,
                "last_updated": session.updated_at.isoformat() if session else None
            }
        finally:
            db.close()

# Dependency for FastAPI routes
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize database
def init_database():
    chat_db = ChatDatabase()
    chat_db.create_tables()
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_database()