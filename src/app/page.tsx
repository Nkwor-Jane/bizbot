import { Ellipsis } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chatbox, DynamicIsland } from "@/features/chat/components";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="md:content-grid relative min-h-dvh grid-rows-[1fr] place-content-start">
      <section
        className={cn(
          "absolute max-md:inset-0 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
          "md:max-w-wPhone md:max-h-hPhone bg-phone m-auto grid size-full grid-rows-[1fr] gap-4 border p-4 md:rounded-[4rem]",
          "transition-colors duration-300 ease-in",
        )}
      >
        <DynamicIsland />
        <div className="flex flex-col gap-6">
          <div className="flex flex-1 flex-col">
            <Button
              size={"icon"}
              variant={"outline"}
              className="hover:bg-background/90 mt-auto mr-1.5 mb-4 ml-auto size-[2.875rem]"
            >
              <Ellipsis />
            </Button>

            <Chatbox />
          </div>
          <div className="mx-auto h-2 w-40 rounded-full border bg-black" />
        </div>
      </section>
    </main>
  );
}
