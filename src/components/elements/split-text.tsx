"use client";
import { motion, type Variants } from "motion/react";

export default function SplitText({ children }: { children: string }) {
  const splitText = children.split(" ");
  return (
    <motion.span
      variants={TEXT_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
      {splitText.map((char, i) => (
        <motion.span layout key={`${char}-${i}`} variants={CHAR_VARIANTS}>
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

const TEXT_VARIANTS = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const CHAR_VARIANTS: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: "tween",
      ease: "circOut",
      duration: 0.15,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      type: "tween",
      ease: "circOut",
      duration: 0.1,
    },
  },
};
