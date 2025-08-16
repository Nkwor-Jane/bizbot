"use client";
import { AnimatePresence, motion, Variants } from "motion/react";

import { ThemeToggle } from "@/features/theme/components";
import { useNotifications } from "@/provider/notifications";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function DynamicIsland() {
  const [expand, setExpand] = useState(false);
  const { notification } = useNotifications();
  console.log("Notifications:", notification);

  useEffect(() => {
    if (notification) setExpand(true);
    else setExpand(false);
    console.log(expand);
  }, [notification]);

  return (
    <section className="fixed top-4 flex w-full justify-center gap-3">
      <button
        onClick={() => setExpand((prev) => !prev)}
        className="size-8 rounded-full border bg-lime-200 text-xs font-bold dark:bg-lime-300 dark:text-zinc-800"
      ></button>
      <motion.div
        variants={VARIANTS}
        initial={"closed"}
        animate={expand ? "open" : "closed"}
        transition={{
          type: "tween",
          duration: 0.6,
          ease: [0.4, 0, 0.2, 1],
        }}
        className="dark:border-border flex size-full items-center justify-center rounded-[1.75rem] border border-zinc-900 bg-black px-4 py-3 text-sm text-zinc-100"
      >
        <AnimatePresence mode="wait">
          {expand && (
            <motion.div
              variants={CHILD_VARIANTS}
              initial="closed"
              animate="open"
              transition={{
                type: "tween",
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1],
                delay: 0.2,
              }}
              className="grid size-full w-fit origin-top grid-cols-[2rem_auto] items-center gap-2"
            >
              <motion.figure
                className={cn(
                  "mx-auto h-3 rounded-full bg-lime-200",
                  notification?.type === "error" && "bg-red-500",
                )}
                variants={LOOP_VARIANTS}
                animate={!(notification?.type === "error") ? "loop" : "static"}
                transition={{
                  type: "tween",
                  repeat: Infinity,
                  repeatType: "reverse",
                  duration: 2.4,
                  ease: [0.4, 0, 0.2, 1],
                }}
              />
              <p>{notification?.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <ThemeToggle />
    </section>
  );
}

const VARIANTS: Variants = {
  open: {
    width: "16rem",
    height: "4rem",
  },
  closed: {
    width: "9rem",
    height: "2rem",
  },
};

const CHILD_VARIANTS: Variants = {
  open: {
    opacity: 1,
    scale: 1,
  },
  closed: {
    opacity: 0,
    scale: 0.8,
  },
};

const LOOP_VARIANTS: Variants = {
  static: {
    width: "2rem",
    height: "2rem",
  },
  loop: {
    width: ["0.75rem", "1.5rem", "2rem", "1.5rem", "0.75rem"],
    height: ["0.75rem", "1.5rem", "0.75rem", "1.5rem", "0.75rem"],
  },
};
