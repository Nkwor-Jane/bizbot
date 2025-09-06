interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: number;
  sources?: ChatSource[];
  detectedLanguage?: string;
}

type ChatSource = { excerpt: string; source: string };

interface ChatPost {
  message: string;
  session_id?: string;
}

interface ChatResponse {
  response: string;
  session_id: string;
  sources?: ChatSource[];
}

interface ChatHistoryResponse {
  history: ChatHistory[];
}

interface ChatHistory {
  user_message?: string;
  bot_response?: string;
  timestamp?: string;
  confidence_score: number;
  sources_used?: ChatSource[];
}
