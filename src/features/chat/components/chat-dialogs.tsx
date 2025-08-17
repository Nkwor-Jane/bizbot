import { cn } from "@/lib/utils";

export default function ChatDialogs() {
  return (
    <article
      className={cn(
        "flex h-full flex-col justify-end gap-2",
        "[&>p>span]:-mb-1 [&>p>span]:block",
        "[&>p>small]:text-xs",
      )}
    >
      <p className="text-lime-900 dark:text-lime-100">
        <span>AI Response</span>
        <small>17:32pm</small>
      </p>
      <p className="ml-auto dark:text-zinc-100">
        <span>Sender</span>
        <small>17:32pm</small>
      </p>
    </article>
  );
}
