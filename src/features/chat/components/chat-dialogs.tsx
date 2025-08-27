"use client";
import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { formatTime } from "@/utils/time";
import { cn } from "@/lib/utils";

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
  console.log("Message::", messages);

  return (
    <article
      ref={scrollRef}
      className={cn(
        "justify-nd no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-4",
        "max-w-[calc(100dvw-2rem)] md:max-w-[calc(27.5rem-2rem)]",
        // "h-full max-h-[calc(100dvh-14rem)] md:max-h-[calc(59.75rem-14rem)]"
      )}
    >
      <div className="mt-auto flex min-h-fit flex-col gap-2">
        {messages.map(({ id, text, sender, timestamp, sources }) => {
          const isUser = sender === "user";
          const isAI = sender === "ai";
          return (
            <div
              key={id}
              className={cn(
                "overflow-wrap-anywhere word-break-break-word flex max-w-[85%] flex-col gap-px break-words hyphens-auto",
                {
                  "text-lime-700 dark:text-lime-100 [&>small]:text-left": isAI,
                },
                {
                  "ml-auto text-right dark:text-zinc-300 [&>small]:ml-auto":
                    isUser,
                },
              )}
            >
              <span
                className={cn(
                  "block whitespace-pre-wrap",
                  "prose-ul:list-disc prose-ul:ml-4 prose-ol:list-decimal prose-ol:ml-4",
                )}
              >
                <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
              </span>
              {sources && sources.length > 0 && (
                <div className="mb-4 space-y-2 text-sm text-lime-900">
                  <h3 className="font-bold">SOURCES</h3>
                  <ul className="space-y-1">
                    {sources.map((source, index) => (
                      <li key={index} className="[&>span]:block">
                        <span>{source.source}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <small className="text-xs">{formatTime(timestamp)}</small>
            </div>
          );
        })}
      </div>
    </article>
  );
}
