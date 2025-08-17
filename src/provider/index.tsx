import { ChatProvider } from "@/features/chat/context";

import NotificationsProvider from "./notifications";
import TanstackProvider from "./tanstack";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TanstackProvider>
      <NotificationsProvider>
        <ChatProvider>{children}</ChatProvider>
      </NotificationsProvider>
    </TanstackProvider>
  );
}
