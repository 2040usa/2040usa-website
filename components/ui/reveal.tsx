"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frame = window.requestAnimationFrame(() => setAnimate(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <motion.div
      className={className}
      initial={false}
      animate={animate ? { opacity: [0.86, 1], y: [10, 0] } : undefined}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
