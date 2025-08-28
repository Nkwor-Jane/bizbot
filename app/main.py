from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from .rag_pipeline import RAGPipeline
from .database import ChatDatabase
from .schema import ChatRequest, ChatResponse
import uuid
import logging
from langdetect import detect
from deep_translator import GoogleTranslator



logger = logging.getLogger("uvicorn.error")

# Initialize components
rag = RAGPipeline()
db = ChatDatabase()


@asynccontextmanager
async def lifespan(app: FastAPI):
    rag.setup_knowledge_base("docs/dataset.json")
    yield

app = FastAPI(title="BizBot Nigeria API", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def translate_to_english(text: str) -> str:
    try:
        return GoogleTranslator(source='auto', target='en').translate(text)
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return text


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        logger.info(f"Incoming request: {request.dict()}")

        # Assign session if missing
        if not request.session_id:
            request.session_id = str(uuid.uuid4())

         # Translate user input to English for uniform processing
        user_msg_original = request.message.strip()
        user_msg = translate_to_english(user_msg_original).lower()

        # user_msg = request.message.lower().strip()

        #  Multi-language greetings
        greetings = {
            "english": ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"],
            "yoruba": ["bawo", "ẹ káàrọ̀", "ẹ káàsán", "ẹ káalẹ́"], 
            "igbo": ["ndewo", "ụtụtụ ọma", "ehihie ọma", "mgbede ọma"],
            "hausa": ["sannu", "ina kwana", "ina wuni", "ina yini"],
            "pidgin": ["how far", "how you dey", "morning oo", "afternoon oo", "evening oo"]
        }

        # Multi-language smalltalk
        smalltalk = {
            "how are you": "I'm doing great, thanks for asking! 😊",
            "bawo ni": "Mo wa dada 🙏. (Yorùbá: I'm fine)",
            "kedụ": "Adị m mma 🙌. (Igbo: I'm fine)",
            "yaya kake": "Lafiya lau 😊. (Hausa: I'm fine)",
            "how you dey": "I dey kampe 💪 (Pidgin: I'm fine)"
        }

        # Check greetings
        for lang, phrases in greetings.items():
            if user_msg in phrases:
                answer = f"Hello 👋, welcome to BizBot Nigeria! ({lang.title()} greeting detected)"
                sources, confidence = [], None

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

        # Check smalltalk
        for key, reply in smalltalk.items():
            if key in user_msg:   # substring match
                answer = reply
                sources, confidence = [], None

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

        # Otherwise, Query RAG pipeline
        result = rag.query(request.message)
        logger.info(f"RAG result: {result}")

        if isinstance(result, dict):
            answer = result.get("answer", "").strip()
            sources = result.get("sources", [])
            confidence = result.get("confidence_score")
        else:
            answer, sources, confidence = str(result), [], None

        # Save conversation into DB
        db.save_conversation(
            session_id=request.session_id,
            user_message=request.message,
            bot_response=answer,
            confidence_score=confidence,
            sources_used=str(sources) if sources else None
        )

        return ChatResponse(
            response=answer,
            session_id=request.session_id,
            sources=sources
        )

    except Exception as e:
        logger.exception("Error in /chat endpoint")
        raise HTTPException(status_code=500, detail=str(e))


# async def chat_endpoint(request: ChatRequest):
#     try:
#         logger.info(f"Incoming request: {request.dict()}")

#         # Assign session if missing
#         if not request.session_id:
#             request.session_id = str(uuid.uuid4())

#         # smalltalk = {
#         #     "how are you": "I'm doing great, thanks for asking! 😊 How can I assist you with Nigerian business information today?",
#         #     "what is your name": "I'm BizBot Nigeria 🤖, your assistant for business and regulatory information in Nigeria.",
#         #     "who created you": "I was built to help answer questions about Nigerian business and compliance matters."
#         # }
#         smalltalk = {
#             "how are you": "I'm doing great, thanks for asking! 😊",
#             "bawo ni": "Mo wa dada 🙏. (Yorùbá: I'm fine)",
#             "kedụ": "Adị m mma 🙌. (Igbo: I'm fine)",
#             "yaya kake": "Lafiya lau 😊. (Hausa: I'm fine)",
#             "how you dey": "I dey kampe 💪 (Pidgin: I'm fine)"
#         }

#         user_msg = request.message.lower().strip()

#         # Handle Greetings before RAG Query
#         # greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"]
#         greetings = {
#             "english": ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"],
#             "yoruba": ["bawo", "ẹ káàrọ̀", "ẹ káàsán", "ẹ káalẹ́"], 
#             "igbo": ["ndewo", "ụtụtụ ọma", "ehihie ọma", "mgbede ọma"],
#             "hausa": ["sannu", "ina kwana", "ina wuni", "ina yini"],
#             "pidgin": ["how far", "how you dey", "morning oo", "afternoon oo", "evening oo"]
#         }
#         # if user_msg in greetings:
#         #     answer = "Hello 👋, welcome to BizBot Nigeria! How can I help you today?"
#         #     sources = []
#         #     confidence = None

#         for lang, phrases in greetings.items():
#             if user_msg in phrases:
#                 answer = f"Hello 👋, welcome to BizBot Nigeria! ({lang.title()} greeting detected)"
#                 sources = []
#                 confidence = None
            
#             # Save conversation into DB
#             db.save_conversation(
#                 session_id=request.session_id,
#                 user_message=request.message,
#                 bot_response=answer,
#                 confidence_score=confidence,
#                 sources_used=None
#             )

#             return ChatResponse(
#                 response=answer,
#                 session_id=request.session_id,
#                 sources=sources
#             )

#         # Handle smalltalk
#         for key, reply in smalltalk.items():
#             if key in user_msg:   # substring match
#                 answer = reply
#                 sources = []
#                 confidence = None
            
#             # Save conversation into DB
#             db.save_conversation(
#                 session_id=request.session_id,
#                 user_message=request.message,
#                 bot_response=answer,
#                 confidence_score=confidence,
#                 sources_used=None
#             )

#             return ChatResponse(
#                 response=answer,
#                 session_id=request.session_id,
#                 sources=sources
#             )

#         # Query RAG pipeline
#         result = rag.query(request.message)
#         logger.info(f"RAG result: {result}")

#         # Handle both dict and string responses
#         if isinstance(result, dict):
#             answer = result.get("answer", "").strip()
#             sources = result.get("sources", [])
#             confidence = result.get("confidence_score")
#         else:
#             answer = result
#             sources = []
#             confidence = None

#         # Save conversation into DB
#         db.save_conversation(
#             session_id=request.session_id,
#             user_message=request.message,
#             bot_response=answer,
#             confidence_score=confidence,
#             sources_used=str(sources) if sources else None
#         )
#         logger.info("Conversation saved to DB")

#         # Return structured response
#         return ChatResponse(
#             response=answer,
#             session_id=request.session_id,
#             sources=sources
#         )

#     except Exception as e:
#         logger.exception("Error in /chat endpoint")
#         raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/history/{session_id}")
async def get_history(session_id: str):
    history = db.get_chat_history(session_id)
    return {"history": history}
