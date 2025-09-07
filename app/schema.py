from pydantic import BaseModel
from typing import List, Optional

class Source(BaseModel):
    source: str
    excerpt: Optional[str]  = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    sources: List[Source] = []
