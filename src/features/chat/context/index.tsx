"use client";

import {
  createContext,
  useReducer,
  useContext,
  ReactNode,
  Dispatch,
  useEffect,
} from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import { sessionStorage } from "@/features/chat/db/session";

interface ChatState {
  messages: ChatMessage[];
  currentSessionId: string | null;
  sessionIds: string[];
}

type ChatAction =
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | {
      type: "UPDATE_MESSAGE";
      payload: { id: string; text: string; detectedLanguage?: string };
    }
  | { type: "RESET_CHAT" }
  | { type: "SET_CURRENT_SESSION"; payload: string | null }
  | { type: "SET_SESSION_IDS"; payload: string[] }
  | { type: "LOAD_SESSION_MESSAGES"; payload: ChatMessage[] };

const initialState: ChatState = {
  messages: [],
  currentSessionId: null,
  sessionIds: [],
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.id
            ? {
                ...msg,
                text: action.payload.text,
                loading: false,
                detectedLanguage: action.payload.detectedLanguage,
              }
            : msg,
        ),
      };
    case "RESET_CHAT":
      return initialState;
    case "SET_CURRENT_SESSION":
      return { ...state, currentSessionId: action.payload };
    case "SET_SESSION_IDS":
      return { ...state, sessionIds: action.payload };
    case "LOAD_SESSION_MESSAGES":
      return { ...state, messages: action.payload };
    default:
      return state;
  }
}

interface ChatContextProps {
  state: ChatState;
  dispatch: Dispatch<ChatAction>;
  addChatMessage: (args: {
    text: ChatMessage["text"];
    sender: ChatMessage["sender"];
    sources?: ChatMessage["sources"];
  }) => void;
  startNewChat: () => void;
  loadChatSession: (sessionId: string) => Promise<void>;
  addNewSessionId: (sessionId: string) => Promise<void>;
  loadSessionIds: () => Promise<void>;
}

const ChatContext = createContext<ChatContextProps>({
  state: initialState,
  dispatch: () => null,
  addChatMessage: () => {},
  startNewChat: () => {},
  loadChatSession: async () => {},
  addNewSessionId: async () => {},
  loadSessionIds: async () => {},
});

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const searchParams = useSearchParams();

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      dispatch({ type: "SET_CURRENT_SESSION", payload: sessionId });
    }
    loadSessionIds();
  }, [searchParams]);

  const addChatMessage = ({
    text,
    sender,
    sources,
  }: {
    text: ChatMessage["text"];
    sender: ChatMessage["sender"];
    sources?: ChatMessage["sources"];
  }) => {
    const message: ChatMessage = {
      id: uuidv4(),
      text,
      sender,
      timestamp: Date.now(),
      sources,
    };

    dispatch({ type: "ADD_MESSAGE", payload: message });
  };

  const startNewChat = () => {
    dispatch({ type: "RESET_CHAT" });
  };

  const addNewSessionId = async (sessionId: string) => {
    try {
      await sessionStorage.addSessionId(sessionId);
      await loadSessionIds(); // Refresh the session IDs list
      dispatch({ type: "SET_CURRENT_SESSION", payload: sessionId });
    } catch (error) {
      console.error("Error adding session ID:", error);
    }
  };

  const loadSessionIds = async () => {
    try {
      const ids = await sessionStorage.getSessionIds();
      dispatch({ type: "SET_SESSION_IDS", payload: ids });
    } catch (error) {
      console.error("Error loading session IDs:", error);
    }
  };

  const loadChatSession = async (sessionId: string) => {
    try {
      // Set current session
      dispatch({ type: "SET_CURRENT_SESSION", payload: sessionId });

      // Clear current messages
      dispatch({ type: "LOAD_SESSION_MESSAGES", payload: [] });

      // Note: The actual API call to load chat history will be handled
      // in the component that calls this function, using the useChatHistory hook
    } catch (error) {
      console.error("Error loading chat session:", error);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        state,
        dispatch,
        addChatMessage,
        startNewChat,
        loadChatSession,
        addNewSessionId,
        loadSessionIds,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}
