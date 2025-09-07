from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from .rag_pipeline import RAGPipeline
from .database import ChatDatabase
from .schema import ChatRequest, ChatResponse
import uuid
import logging
import time
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

def detect_language(text: str) -> str:
    """Detect the language of input text"""
    try:
        detected_lang = detect(text.strip())
        logger.info(f"Detected language: {detected_lang}")
        return detected_lang
    except Exception as e:
        logger.error(f"Language detection failed: {e}")
        return "en"  # Default to English

def safe_translate(text: str, source_lang: str = "auto", target_lang: str = "en") -> str:
    """Safely translate text between languages"""
    try:
        if source_lang == target_lang:
            return text
        
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated = translator.translate(text.strip())
        logger.info(f"Translated from {source_lang} to {target_lang}")
        return translated
    except Exception as e:
        logger.error(f"Translation failed from {source_lang} to {target_lang}: {e}")
        return text

def safe_translate_to_english(text: str) -> str:
    try:
        detected_lang = detect(text)
        if detected_lang == "en":
            return text  # skip translation if already English
        return GoogleTranslator(source="auto", target="en").translate(text)
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return text

def normalize_sources(sources):
    """Ensure sources are always JSON-friendly dicts"""
    if not sources:
        return []
    
    normalized = []
    for s in sources:
        if isinstance(s, dict):
            normalized.append({
                "source": s.get("source", str(s)),
                "excerpt": s.get("excerpt", "")
            })
        else:
            normalized.append({
                "source": str(s),
                "excerpt": ""
            })
    return normalized

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        logger.info(f"Incoming request: {request.dict()}")

        if not request.session_id:
            request.session_id = str(uuid.uuid4())

        user_msg_original = request.message.strip()
        detected_lang = detect_language(user_msg_original)

        # Translate to English if necessary for processing
        user_msg_english = safe_translate(
            user_msg_original, 
            source_lang=detected_lang, 
            target_lang="en"
        )

        start_time = time.time()
        result = rag.query(user_msg_english)
        duration = time.time() - start_time

        if isinstance(result, dict):
            answer = result.get("answer", "").strip()
            sources = normalize_sources(result.get("sources", []))
            confidence = result.get("confidence_score")
        else:
            answer, sources, confidence = str(result), [], None

         # Translate response back to user's language if needed
        if detected_lang != "en" and answer:
            answer_final = safe_translate(
                answer,
                source_lang="en",
                target_lang=detected_lang
            )
            logger.info(f"Response translated back to {detected_lang}")
        else:
            answer_final = answer
            logger.info("No translation needed, keeping English response")

        db.save_conversation(
            session_id=request.session_id,
            user_message=user_msg_original,
            bot_response=answer_final,
            confidence_score=confidence,
            sources_used=sources
        )
        logger.info(f"Answered in {duration:.2f}s | Confidence={confidence}")
        return ChatResponse(response=answer_final, 
                            session_id=request.session_id, sources=sources)

    except Exception as e:
        logger.exception("Error in /chat endpoint")
        error_msg = "Sorry, I encountered an error while processing your request. Please try again."
        try:
            if 'detected_lang' in locals() and detected_lang != "en":
                error_msg = safe_translate(error_msg, "en", detected_lang)
        except:
            pass
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/history/{session_id}")
async def get_history(session_id: str):
    history = db.get_chat_history(session_id)
    return {"history": history}

@app.get("/stats")
async def get_stats():
    """Get RAG pipeline statistics"""
    return rag.get_stats()

@app.get("/health-detailed")
async def detailed_health_check():
    """Detailed health check including RAG pipeline"""
    return rag.health_check()