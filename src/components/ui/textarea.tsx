"use client";
import * as React from "react";
import { HTMLMotionProps, motion } from "motion/react";

import { cn } from "@/lib/utils";

type TextareaProps = Omit<React.ComponentProps<"textarea">, "onDrag"> &
  HTMLMotionProps<"textarea">;

function Textarea({ className, ...props }: TextareaProps) {
  return (
    <motion.textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-[1.875rem] border bg-white px-3 pl-4 py-5 text-base shadow-xs transition-[color,box-shadow,height] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
