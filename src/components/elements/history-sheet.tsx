"use client";
import { Plus, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useChat } from "@/features/chat/context";
import { sessionStorage } from "@/features/chat/db/session";
import { cn } from "@/lib/utils";

export default function HistorySheet({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const {
    state: { sessionIds, currentSessionId },
    loadChatSession,
    startNewChat,
    loadSessionIds,
  } = useChat();

  useEffect(() => {
    loadSessionIds();
  }, []);

  const handleSessionClick = async (sessionId: string) => {
    if (sessionId !== currentSessionId) {
      // Set the session as current
      await loadChatSession(sessionId);

      // Set search param in URL to persist session
      const url = new URL(window.location.href);
      url.searchParams.set("session_id", sessionId);
      router.replace(url.toString());

      setOpen(false);
    }
  };

  const handleDeleteSession = async (
    sessionId: string,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();

    try {
      await sessionStorage.removeSessionId(sessionId);
      await loadSessionIds(); // Refresh the session list

      // If deleted the current session is deleted, start a new chat
      if (sessionId === currentSessionId) startNewChat();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleNewChat = () => {
    startNewChat();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="top"
        className="max-h-1/2 min-h-1/2 overflow-y-auto max-md:max-h-[60%]"
      >
        <section className="content-grid relative space-y-4 lg:space-y-8">
          <SheetHeader className="bg-background sticky top-0 z-10 w-full px-0 pt-6">
            <SheetTitle className="uppercase">Chat History</SheetTitle>
            <SheetDescription>
              What did you chat about last time?
            </SheetDescription>
          </SheetHeader>

          <dl
            className={cn(
              "grid gap-x-4 gap-y-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-x-6",
              "[&>div,button]:flex [&>div,button]:items-center [&>div,button]:gap-2 [&>div,button]:rounded-2xl [&>div,button]:border [&>div,button]:p-4",
            )}
          >
            {sessionIds.length === 0 ? (
              <div className="text-muted-foreground size-full flex-col justify-center py-4 text-center md:col-span-2 lg:col-span-4">
                <p>No chat history yet</p>
                <p className="text-sm">Start a conversation to see it here</p>
              </div>
            ) : (
              <>
                <button
                  onClick={handleNewChat}
                  className="bg-border cursor-pointer"
                >
                  <Plus size={20} className="opacity-50" />{" "}
                  <span className="font-medium">New Chat</span>
                </button>
                {sessionIds.map((sessionId, index) => (
                  <button
                    key={sessionId}
                    onClick={() => handleSessionClick(sessionId)}
                    className={cn(
                      "group relative flex items-center justify-start gap-2",
                      {
                        "border-lime-500": currentSessionId === sessionId,
                      },
                    )}
                  >
                    <span className="font-black opacity-25">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <dt className="line-clamp-1 text-left font-medium">
                      {sessionId}
                    </dt>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleDeleteSession(sessionId, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          handleDeleteSession(sessionId, e as any);
                        }
                      }}
                      className="absolute right-4 grid size-8 place-content-center rounded-full bg-red-100 text-red-500 group-hover:opacity-100 lg:-top-2 lg:-right-2 xl:opacity-0 dark:bg-red-950"
                    >
                      <Trash size={14} />
                    </span>
                  </button>
                ))}
              </>
            )}
          </dl>
        </section>
        <SheetClose className="sticky bottom-4 mt-auto mb-2">
          <div
            aria-hidden
            className="mx-auto mt-4 h-1.5 w-20 rounded-full border bg-zinc-300 lg:w-40"
          />
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
