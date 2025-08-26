import { api, apiClient } from "@/lib/axios";

export const ChatService = {
  getChat: {
    server: async (data: ChatPost) => {
      const response = await api.post("/chat", { ...data });
      return response.data;
    },
    client: async (data: ChatPost) => {
      const response = await apiClient.post("/chat", { ...data });
      return response.data;
    },
  },

  getChatHistory: {
    server: async (session_id: string) => {
      const { data } = await api.get(`/history/${session_id}`);
      return data;
    },
    client: async (session_id: string) => {
      const { data } = await apiClient.get(`/history/${session_id}`);
      return data;
    },
  },
};
