"use client";
import { useRef, useState } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function HistorySheet() {
  const [open, setOpen] = useState(false);
  const startY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startY.current !== null) {
      const endY = e.changedTouches[0].clientY;
      const diff = startY.current - endY;

      // if dragged upward enough, open the sheet
      if (diff > 50) {
        setOpen(true);
      }
    }
    startY.current = null;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger>
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="mx-auto mt-4 h-1.5 w-40 rounded-full border bg-black hover:cursor-grab active:cursor-grabbing"
        />
      </SheetTrigger>
      <SheetContent side="top" className="min-h-1/2">
        <SheetHeader>
          <SheetTitle>Chat History</SheetTitle>
          <SheetDescription>
            What did you chat about last time?
          </SheetDescription>
        </SheetHeader>

        <SheetClose className="mt-auto mb-2">
          <div
            aria-hidden
            className="mx-auto mt-4 h-1.5 w-40 rounded-full border bg-zinc-300"
          />
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
