"use client";
import { Ellipsis } from "lucide-react";
import { AnimatePresence, motion, Variants } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { HistorySheet } from "@/components/elements";
import { cn } from "@/lib/utils";

export default function MoreEllipsis() {
  const [openMore, _setOpenMore] = useState<boolean>(false);

  return (
    <div className="relative mb-4 flex flex-col items-end">
      <AnimatePresence mode="wait">
        {openMore && (
          <motion.div
            variants={VARIANTS}
            initial={"closed"}
            animate={openMore ? "open" : "closed"}
            exit={"closed"}
            transition={{
              type: "tween",
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1],
            }}
            className={cn(
              "no-scrollbar absolute right-[3.875rem] size-full max-w-[calc(100%-3.875rem)] origin-[right_center] overflow-hidden overflow-x-auto rounded-[1.75rem] border-[0.5px] border-lime-500 bg-lime-50 text-lime-700 shadow-sm transition-colors duration-300 ease-in",
              "dark:bg-lime-950 dark:text-lime-50",
            )}
          >
            <motion.ul
              variants={LIST_VARIANTS}
              initial="hidden"
              animate="visible"
              className="flex w-fit items-center"
            >
              {[
                "Item 1",
                "Item 2",
                "Item 3",
                "Item 4",
                "Item 5",
                "Item 6",
                "Item 7",
                "Item 8",
                "Item 9",
                "Item 10",
              ].map((tip) => (
                <motion.li
                  key={tip}
                  variants={ITEM_VARIANTS}
                  className="shrink-0 px-3"
                >
                  {tip}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
      <HistorySheet>
        <Button
          size={"icon"}
          variant={"outline"}
          // onClick={() => setOpenMore((prev) => !prev)}
          className="hover:bg-background/90 size-[2.875rem] shadow-xs"
        >
          <Ellipsis />
        </Button>
      </HistorySheet>
    </div>
  );
}

const VARIANTS: Variants = {
  open: {
    width: "100%", // 🎯 Stage 1: Width animates first
    // height: "2.875rem",
    scaleY: 1, // 🎯 Stage 2: Scale animates second
    padding: "0.675rem", // 🎯 Stage 3: Padding adds last
    marginBottom: "1rem",
    opacity: 1,
    transition: {
      width: {
        duration: 0.3,
        delay: 0.2, // ⏰ Starts after height
        ease: [0.4, 0, 0.2, 1],
      },
      scaleY: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      },
      padding: {
        duration: 0.2,
        delay: 0.3, // ⏰ Starts after width
      },
    },
  },
  closed: {
    width: "0rem",
    // height: "0rem",
    scaleY: 0,
    padding: "0rem",
    marginBottom: "0rem",
    opacity: 0,
    transition: {
      scaleY: {
        delay: 0.3,
      },
    },
  },
};

const LIST_VARIANTS: Variants = {
  visible: {
    transition: {
      delayChildren: 0.5, // ⏰ Wait for container to finish
      staggerChildren: 0.1, // 📝 Each child delays by 0.1s
    },
  },
};

const ITEM_VARIANTS: Variants = {
  visible: {
    opacity: 1,
    x: 0,
  },
  hidden: {
    opacity: 0,
    x: -10,
  },
};
