interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: number;
  sources?: { excerpt: string; source: string }[];
  detectedLanguage?: string;
}

interface ChatPost {
  message: string;
}
