"use client";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/time";

import { useChat } from "../context";

export default function ChatDialogs() {
  const {
    state: { messages },
  } = useChat();

  const scrollRef = useRef<HTMLElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <article
      ref={scrollRef}
      className={cn(
        "justify-nd no-scrollbar py-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto",
        "max-w-[calc(100dvw-2rem)] md:max-w-[calc(27.5rem-2rem)]",
        // "h-full max-h-[calc(100dvh-14rem)] md:max-h-[calc(59.75rem-14rem)]"
      )}
    >
      <div className="mt-auto flex min-h-fit flex-col gap-2">
        {messages.map(({ id, text, sender, timestamp }) => {
          const isUser = sender === "user";
          const isAI = sender === "ai";
          return (
            <p
              key={id}
              className={cn(
                "overflow-wrap-anywhere word-break-break-word flex max-w-[85%] flex-col break-words hyphens-auto",
                {
                  "text-lime-700 dark:text-lime-100 [&>small]:text-left": isAI,
                },
                { "ml-auto text-right dark:text-zinc-300 [&>small]:ml-auto": isUser },
              )}
            >
              <span className="block whitespace-pre-wrap">{text}</span>
              <small className="text-xs">{formatTime(timestamp)}</small>
            </p>
          );
        })}
      </div>
    </article>
  );
}
