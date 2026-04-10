"use client";

import React, { useRef } from "react";

export type MagneticProps = {
	children: React.ReactNode;
	className?: string;
	strength?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function Magnetic({ children, className, strength = 0.28 }: MagneticProps) {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const pendingRef = useRef<{ x: number; y: number } | null>(null);

	const commit = () => {
		const root = rootRef.current;
		const pending = pendingRef.current;
		if (!root || !pending) return;
		root.style.setProperty("--magnetic-x", `${pending.x}px`);
		root.style.setProperty("--magnetic-y", `${pending.y}px`);
		pendingRef.current = null;
		rafRef.current = null;
	};

	const schedule = () => {
		if (rafRef.current != null) return;
		rafRef.current = window.requestAnimationFrame(commit);
	};

	const onPointerMove = (evt: React.PointerEvent<HTMLDivElement>) => {
		const root = rootRef.current;
		if (!root) return;
		const rect = root.getBoundingClientRect();
		const relX = evt.clientX - rect.left;
		const relY = evt.clientY - rect.top;
		const nx = rect.width ? (relX / rect.width) * 2 - 1 : 0;
		const ny = rect.height ? (relY / rect.height) * 2 - 1 : 0;

		const maxOffset = 14;
		const x = clamp(nx, -1, 1) * maxOffset * strength;
		const y = clamp(ny, -1, 1) * maxOffset * strength;

		pendingRef.current = { x, y };
		schedule();
	};

	const onPointerLeave = () => {
		const root = rootRef.current;
		if (!root) return;
		root.style.setProperty("--magnetic-x", "0px");
		root.style.setProperty("--magnetic-y", "0px");
	};

	return (
		<div
			ref={rootRef}
			onPointerMove={onPointerMove}
			onPointerLeave={onPointerLeave}
			className={`inline-block [transform:translate3d(var(--magnetic-x,0px),var(--magnetic-y,0px),0)] transition-transform duration-200 ease-out ${
				className ?? ""
			}`}
			style={
				{
					["--magnetic-x" as any]: "0px",
					["--magnetic-y" as any]: "0px",
				} as React.CSSProperties
			}
		>
			{children}
		</div>
	);
}
