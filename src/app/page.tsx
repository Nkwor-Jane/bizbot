import { DynamicIsland } from "@/components/elements";
import { Chatbox, ChatDialogs, MoreEllipsis } from "@/features/chat/components";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="md:content-grid relative min-h-dvh grid-rows-[1fr] place-content-start">
      <section
        className={cn(
          "absolute max-md:inset-0 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
          "md:max-w-wPhone md:max-h-hPhone bg-phone m-auto grid size-full grid-rows-[1fr] gap-4 p-4 md:rounded-[3.5rem] md:border",
          "transition-colors duration-300 ease-in",
        )}
      >
        <DynamicIsland />
        <div className="flex flex-1 flex-col pt-10 min-h-0">
          <ChatDialogs />
          <div className="flex flex-col">
            <MoreEllipsis />
            <Chatbox />
          </div>
          <div className="mx-auto h-2 w-40 rounded-full border bg-black" />
        </div>
      </section>
    </main>
  );
}
