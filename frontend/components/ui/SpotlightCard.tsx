"use client";

import React, { useRef } from "react";

export type SpotlightCardProps = {
	children: React.ReactNode;
	className?: string;
	spotlightColor?: string;
};

const DEFAULT_SPOTLIGHT = "rgba(209, 132, 0, 0.15)";

export default function SpotlightCard({
	children,
	className,
	spotlightColor = DEFAULT_SPOTLIGHT,
}: SpotlightCardProps) {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const pendingRef = useRef<{ x: number; y: number } | null>(null);

	const commitPosition = () => {
		const root = rootRef.current;
		const pending = pendingRef.current;
		if (!root || !pending) return;
		root.style.setProperty("--spotlight-x", `${pending.x}px`);
		root.style.setProperty("--spotlight-y", `${pending.y}px`);
		pendingRef.current = null;
		rafRef.current = null;
	};

	const scheduleCommit = () => {
		if (rafRef.current != null) return;
		rafRef.current = window.requestAnimationFrame(commitPosition);
	};

	const updateFromPointerEvent = (evt: React.PointerEvent<HTMLDivElement>) => {
		const rect = evt.currentTarget.getBoundingClientRect();
		const x = evt.clientX - rect.left;
		const y = evt.clientY - rect.top;
		pendingRef.current = { x, y };
		scheduleCommit();
	};

	const resetToCenter = () => {
		const root = rootRef.current;
		if (!root) return;
		root.style.setProperty("--spotlight-x", "50%");
		root.style.setProperty("--spotlight-y", "50%");
	};

	return (
      <div
          ref={rootRef}
          onPointerMove={updateFromPointerEvent}
          onPointerEnter={updateFromPointerEvent}
          onPointerLeave={resetToCenter}

          className={`group relative overflow-hidden bg-white dark:bg-zinc-900/40 rounded-2xl border border-zinc-200/60 dark:border-white/5 transition-all duration-300 ${className ?? ""}`}
          style={
              {
                  ["--spotlight-color" as any]: spotlightColor,
                  ["--spotlight-x" as any]: "50%",
                  ["--spotlight-y" as any]: "50%",
              } as React.CSSProperties
          }
      >
          <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                  backgroundImage:
                      "radial-gradient(circle at var(--spotlight-x) var(--spotlight-y), var(--spotlight-color), transparent 65%)",
              }}
          />
          {children}
      </div>
  );
}

