"use client";

import {
  createContext,
  useReducer,
  useContext,
  ReactNode,
  Dispatch,
} from "react";
import { v4 as uuidv4 } from "uuid";

interface ChatState {
  messages: ChatMessage[];
}

type ChatAction =
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | {
      type: "UPDATE_MESSAGE";
      payload: { id: string; text: string; detectedLanguage?: string };
    }
  | { type: "RESET_CHAT" };

const initialState: ChatState = {
  messages: [],
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
  }) => void;
}

const ChatContext = createContext<ChatContextProps>({
  state: initialState,
  dispatch: () => null,
  addChatMessage: () => {},
});

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const addChatMessage = ({
    text,
    sender,
  }: {
    text: ChatMessage["text"];
    sender: ChatMessage["sender"];
  }) => {
    const message: ChatMessage = {
      id: uuidv4(),
      text,
      sender,
      timestamp: Date.now(),
      // detectedLanguage: sourceLanguage,
    };

    dispatch({ type: "ADD_MESSAGE", payload: message });
  };

  return (
    <ChatContext.Provider value={{ state, dispatch, addChatMessage }}>
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
