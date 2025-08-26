import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BOT_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // withCredentials: true,
});

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || '', 
  headers: {
    'Content-Type': 'application/json',
  },
});