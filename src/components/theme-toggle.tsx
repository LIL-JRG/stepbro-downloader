"use client";

import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  function toggleTheme() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const doc = document as ViewTransitionDocument;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Fall back to an instant switch when the View Transitions API is unavailable
    // or the user asked for reduced motion.
    if (typeof doc.startViewTransition !== "function" || prefersReduced) {
      setTheme(next);
      return;
    }

    // flushSync forces next-themes' class change to commit inside the transition
    // callback, so the API captures the before/after snapshots for the reveal.
    doc.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-8 shrink-0", className)}
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
