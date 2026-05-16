"use client";

import React, { useRef } from "react";

export type TiltedCardProps = React.ComponentPropsWithoutRef<"div"> & {
	maxTilt?: number;
	perspective?: number;
	scale?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function TiltedCard({
	children,
	className,
	maxTilt = 9,
	perspective = 900,
	scale = 1.02,
	onPointerMove: onPointerMoveProp,
	onPointerEnter: onPointerEnterProp,
	onPointerLeave: onPointerLeaveProp,
	style: styleProp,
	...rest
}: TiltedCardProps) {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const pendingRef = useRef<{ rx: number; ry: number } | null>(null);

	const commit = () => {
		const root = rootRef.current;
		const pending = pendingRef.current;
		if (!root || !pending) return;
		root.style.setProperty("--tilt-rx", `${pending.rx}deg`);
		root.style.setProperty("--tilt-ry", `${pending.ry}deg`);
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
		const x = evt.clientX - rect.left;
		const y = evt.clientY - rect.top;
		const nx = rect.width ? (x / rect.width) * 2 - 1 : 0;
		const ny = rect.height ? (y / rect.height) * 2 - 1 : 0;

		const tilt = Math.max(0, Math.min(18, Number(maxTilt) || 0));
		const rx = clamp(-ny, -1, 1) * tilt;
		const ry = clamp(nx, -1, 1) * tilt;

		pendingRef.current = { rx, ry };
		schedule();
	};

	const reset = () => {
		const root = rootRef.current;
		if (!root) return;
		root.style.setProperty("--tilt-rx", "0deg");
		root.style.setProperty("--tilt-ry", "0deg");
	};

	return (
		<div
			{...rest}
			ref={rootRef}
			onPointerMove={(evt) => {
				onPointerMove(evt);
				onPointerMoveProp?.(evt);
			}}
			onPointerEnter={(evt) => {
				onPointerMove(evt);
				onPointerEnterProp?.(evt);
			}}
			onPointerLeave={(evt) => {
				reset();
				onPointerLeaveProp?.(evt);
			}}
			className={
				"relative [transform-style:preserve-3d] will-change-transform " +
					(className ?? "")
			}
			style={
				{
					...(styleProp ?? {}),
					perspective: `${Number(perspective) || 900}px`,
					["--tilt-rx" as any]: "0deg",
					["--tilt-ry" as any]: "0deg",
				} as React.CSSProperties
			}
		>
			<div
				className="h-full w-full transition-transform duration-200 ease-out [transform-style:preserve-3d]"
				style={{
					transform: `rotateX(var(--tilt-rx)) rotateY(var(--tilt-ry)) scale(${Number(scale) || 1})`,
				}}
			>
				{children}
			</div>
		</div>
	);
}
