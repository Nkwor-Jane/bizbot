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
  return (
    <Sheet>
      <SheetTrigger>
        <div
          aria-hidden
          className="mx-auto mt-4 h-1.5 w-40 rounded-full border bg-black"
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
