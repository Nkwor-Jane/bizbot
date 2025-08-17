"use client";
import { Ellipsis } from "lucide-react";
import { AnimatePresence, motion, Variants } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export default function MoreEllipsis() {
  const [openMore, setOpenMore] = useState<boolean>(false);

  return (
    <div className="relative mt-auto mr-1.5 mb-4 flex flex-col items-end">
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
            className="size-full origin-bottom overflow-hidden rounded-[1.75rem] border-[0.5px] border-lime-500 bg-lime-50 text-lime-700 shadow-sm"
          >
            <motion.ul
              variants={LIST_VARIANTS}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap gap-2"
            >
              {["Tip 1", "Tip 2", ""].map((tip) => (
                <motion.li key={tip} variants={ITEM_VARIANTS} className="">
                  {tip}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
      <Button
        size={"icon"}
        variant={"outline"}
        onClick={() => setOpenMore((prev) => !prev)}
        className="hover:bg-background/90 size-[2.875rem] shadow-xs"
      >
        <Ellipsis />
      </Button>
    </div>
  );
}

const VARIANTS: Variants = {
  open: {
    width: "100%", // 🎯 Stage 1: Width animates first
    height: "6rem", // 🎯 Stage 2: Height animates second
    padding: "1rem", // 🎯 Stage 3: Padding adds last
    marginBottom: "1rem",
    opacity: 1,
    transition: {
      width: {
        duration: 0.3,
        delay: 0.2, // ⏰ Starts after height
        ease: [0.4, 0, 0.2, 1],
      },
      height: {
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
    height: "0rem",
    padding: "0rem",
    marginBottom: "0rem",
    opacity: 0,
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
