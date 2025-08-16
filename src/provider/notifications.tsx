"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";

type Notification = {
  id: string;
  message: string;
  type?: "success" | "error" | "info" | "loading";
};

type NotificationsContextType = {
  notification: Notification | null;
  addNotification: (notif: {
    message: string;
    type?: Notification["type"];
  }) => void;
  removeNotification: () => void;
};

const NotificationsContext = createContext<
  NotificationsContextType | undefined
>(undefined);

export default function NotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const removeNotification = useCallback(() => {
    // Clear the timeout if it exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setNotification(null);
  }, []);

  const addNotification = useCallback(
    (notif: { message: string; type?: Notification["type"] }) => {
      const { message, type = "info" } = notif;
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      const id = crypto.randomUUID();
      const newNotification = { id, message, type };
      
      setNotification(newNotification);

      // Set timeout for auto-removal
      // timeoutRef.current = setTimeout(() => {
      //   setNotification(null);
      //   timeoutRef.current = null;
      // }, 3000);
    },
    [],
  );

  return (
    <NotificationsContext.Provider
      value={{ notification, addNotification, removeNotification }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationsProvider",
    );
  }
  return context;
}
