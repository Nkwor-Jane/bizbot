from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .rag_pipeline import RAGPipeline
from .database import ChatDatabase
from .schema import ChatRequest, ChatResponse
import uuid
import logging

app = FastAPI(title="BizBot Nigeria API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("uvicorn.error")

# Initialize components
rag = RAGPipeline()
db = ChatDatabase()

# Load knowledge base on startup
@app.on_event("startup")
async def startup_event():
    rag.setup_knowledge_base(
        r"docs\Nigerian Business FAQs.pdf"
    )

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        logger.info(f"Incoming request: {request.dict()}")

        # Assign session if missing
        if not request.session_id:
            request.session_id = str(uuid.uuid4())

        # Handle Greetings before RAG Query
        greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"]
        if request.message.lower() in greetings:
            answer = "Hello 👋, welcome to BizBot Nigeria! How can I help you today?"
            sources = []
            confidence = None

            # Save conversation into DB
            db.save_conversation(
                session_id=request.session_id,
                user_message=request.message,
                bot_response=answer,
                confidence_score=confidence,
                sources_used=None
            )

            return ChatResponse(
                response=answer,
                session_id=request.session_id,
                sources=sources
            )

        # Query RAG pipeline
        result = rag.query(request.message)
        logger.info(f"RAG result: {result}")

        # Handle both dict and string responses
        if isinstance(result, dict):
            answer = result.get("answer", "").strip()
            sources = result.get("sources", [])
            confidence = result.get("confidence_score")
        else:
            answer = result
            sources = []
            confidence = None

        # Save conversation into DB
        db.save_conversation(
            session_id=request.session_id,
            user_message=request.message,
            bot_response=answer,
            confidence_score=confidence,
            sources_used=str(sources) if sources else None
        )
        logger.info("Conversation saved to DB")

        # Return structured response
        return ChatResponse(
            response=answer,
            session_id=request.session_id,
            sources=sources
        )

    except Exception as e:
        logger.exception("Error in /chat endpoint")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/history/{session_id}")
async def get_history(session_id: str):
    history = db.get_chat_history(session_id)
    return {"history": history}
