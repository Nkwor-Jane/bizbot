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

rag = RAGPipeline()
db = ChatDatabase()

@asynccontextmanager
async def lifespan(app: FastAPI):
    rag.setup_knowledge_base("docs/dataset.json")
    yield

app = FastAPI(title="BizBot Nigeria API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def safe_translate_to_english(text: str) -> str:
    try:
        detected_lang = detect(text)
        if detected_lang == "en":
            return text  # skip translation if already English
        return GoogleTranslator(source="auto", target="en").translate(text)
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return text

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        logger.info(f"Incoming request: {request.dict()}")

        if not request.session_id:
            request.session_id = str(uuid.uuid4())

        user_msg_original = request.message.strip()
        user_msg = safe_translate_to_english(user_msg_original).lower()

        greetings = {
            "english": ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"],
            "yoruba": ["bawo", "ẹ káàrọ̀", "ẹ káàsán", "ẹ káalẹ́"],
            "igbo": ["ndewo", "ụtụtụ ọma", "ehihie ọma", "mgbede ọma"],
            "hausa": ["sannu", "ina kwana", "ina wuni", "ina yini"],
            "pidgin": ["how far", "how you dey", "morning oo", "afternoon oo", "evening oo"]
        }

        smalltalk = {
            "how are you": "I'm doing great, thanks for asking! 😊",
            "bawo ni": "Mo wa dada 🙏. (Yorùbá: I'm fine)",
            "kedụ": "Adị m mma 🙌. (Igbo: I'm fine)",
            "yaya kake": "Lafiya lau 😊. (Hausa: I'm fine)",
            "how you dey": "I dey kampe 💪 (Pidgin: I'm fine)",
            "what is your name": "I'm BizBot Nigeria 🤖, your assistant for business and regulatory information in Nigeria.",
            "why were you created": "I was built to help answer questions about Nigerian business and compliance matters."
        }

        for lang, phrases in greetings.items():
            if user_msg in phrases:
                answer = f"Hello 👋, welcome to BizBot Nigeria! ({lang.title()} greeting detected)"
                db.save_conversation(
                    session_id=request.session_id,
                    user_message=request.message,
                    bot_response=answer,
                    confidence_score=None,
                    sources_used=[]
                )
                return ChatResponse(response=answer, session_id=request.session_id, sources=[])

        for key, reply in smalltalk.items():
            if key in user_msg:
                answer = reply
                db.save_conversation(
                    session_id=request.session_id,
                    user_message=request.message,
                    bot_response=answer,
                    confidence_score=None,
                    sources_used=[]
                )
                return ChatResponse(response=answer, session_id=request.session_id, sources=[])

        result = rag.query(request.message)
        logger.info(f"RAG result: {result}")

        if isinstance(result, dict):
            answer = result.get("answer", "").strip()
            sources = result.get("sources", [])
            confidence = result.get("confidence_score")
        else:
            answer, sources, confidence = str(result), [], None

        db.save_conversation(
            session_id=request.session_id,
            user_message=request.message,
            bot_response=answer,
            confidence_score=confidence,
            sources_used=sources
        )

        return ChatResponse(response=answer, session_id=request.session_id, sources=sources)

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
