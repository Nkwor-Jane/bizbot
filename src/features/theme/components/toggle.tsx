"use client";

import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

import { toggleVariant } from "@/constants/variants";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const initial =
      stored ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(initial);
  }, []);

  useEffect(() => {
    if (!theme) return;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  if (!theme) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="grid size-8 place-content-center rounded-full bg-zinc-200 dark:bg-zinc-800"
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === "dark" ? (
          <motion.span
            key={"moon"}
            variants={toggleVariant}
            initial={"initial"}
            animate={"animate"}
            exit={"exit"}
            transition={{ duration: 0.1 }}
          >
            <Moon size={16} />
          </motion.span>
        ) : (
          <motion.span
            key={"sun"}
            variants={toggleVariant}
            initial={"initial"}
            animate={"animate"}
            exit={"exit"}
            transition={{ duration: 0.1 }}
          >
            <Sun size={16} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
