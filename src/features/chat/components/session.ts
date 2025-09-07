"use client";

import { useEffect } from "react";

import { useChat } from "@/features/chat/context";
import { useChatHistory } from "@/features/chat/hook/queries";
import { useNotifications } from "@/provider/notifications";

import { parseSources } from "../utils/string";

// This component handles the logic for loading chat history when a session is selected
export default function ChatSessionManager() {
  const {
    state: { currentSessionId },
    dispatch,
  } = useChat();
  const { addNotification, removeNotification } = useNotifications();

  const {
    data: historyData,
    isLoading,
    isSuccess,
    error,
  } = useChatHistory(currentSessionId || "");

  useEffect(() => {
    if (isLoading) {
      addNotification({ message: "Loading Chat", type: "loading" });
    } else {
      removeNotification();
    }
  }, [isLoading]);

  // When history data is successfully loaded, update the messages in context
  useEffect(() => {
    if (isSuccess && historyData && currentSessionId) {
      // Transform the API response to ChatMessage format
      const messages = historyData.history
        .map((item: ChatHistory, index: number) => {
          const messages = [];

          // Add user message if it exists
          if (item.user_message) {
            messages.push({
              id: `${currentSessionId}-user-${index}`,
              text: item.user_message,
              sender: "user" as const,
              timestamp: item.timestamp
                ? new Date(item.timestamp).getTime()
                : Date.now(),
              sources: [],
            });
          }

          // Add bot message if it exists
          if (item.bot_response) {
            // const parsedSources = parseSources(item.sources_used);

            messages.push({
              id: `${currentSessionId}-bot-${index}`,
              text: item.bot_response,
              sender: "ai" as const,
              timestamp: item.timestamp
                ? new Date(item.timestamp).getTime()
                : Date.now(),
              sources: [],
            });
          }

          return messages;
        })
        .flat();

      // Update the messages in the context
      dispatch({ type: "LOAD_SESSION_MESSAGES", payload: messages });
    }
  }, [isSuccess, historyData, currentSessionId, dispatch]);

  // Handle error
  useEffect(() => {
    if (error) {
      console.error("Error loading chat history:", error);
    }
  }, [error]);

  // This component doesn't render anything, it just manages the session loading logic
  return null;
}
