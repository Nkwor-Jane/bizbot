import { useMutation, useQuery } from "@tanstack/react-query";

import { useNotifications } from "@/provider/notifications";

import { ChatService } from "../services";

const CHAT_QUERY_KEY = ["chat"];

export const usePostChat = () => {
  const { addNotification, removeNotification } = useNotifications();

  return useMutation({
    mutationFn: (data: ChatPost) => ChatService.getChat.client({ ...data }),
    onMutate: () => addNotification({ message: "Analyzing", type: "loading" }),
    onSettled: () => removeNotification(),
    onError: (error) => {
      console.log("Error:", error);
      addNotification({ message: "Something went wrong", type: "error" });
    },
  });
};

export const useChatHistory = (session_id: string) =>
  useQuery<ChatHistoryResponse>({
    queryKey: [...CHAT_QUERY_KEY, "history", session_id],
    queryFn: () => ChatService.getChatHistory.client(session_id),
    enabled: !!session_id,
    staleTime: 5 * 60 * 1000,
  });
