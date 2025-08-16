import NotificationsProvider from "./notifications";
import TanstackProvider from "./tanstack";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TanstackProvider>
      <NotificationsProvider>{children}</NotificationsProvider>
    </TanstackProvider>
  );
}
