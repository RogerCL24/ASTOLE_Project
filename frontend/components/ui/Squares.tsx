"use client";

import React, { useEffect, useMemo, useRef } from "react";

type SquaresDirection = "diagonal" | "horizontal" | "vertical";

export type SquaresProps = {
	className?: string;
	direction?: SquaresDirection;
	borderColor?: string;
	hoverIntensity?: number;
	cellSize?: number;
};

type ParsedRgba = { r: number; g: number; b: number; a: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const parseRgba = (value: string, fallback: ParsedRgba): ParsedRgba => {
	const raw = String(value ?? "").trim();
	const match = raw.match(
		/rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|0?\.\d+|1(?:\.0+)?)\s*\)/i,
	);
	if (!match) return fallback;

	const r = Number(match[1]);
	const g = Number(match[2]);
	const b = Number(match[3]);
	const a = Number(match[4]);

	if (![r, g, b, a].every((n) => Number.isFinite(n))) return fallback;
	return {
		r: Math.min(255, Math.max(0, Math.round(r))),
		g: Math.min(255, Math.max(0, Math.round(g))),
		b: Math.min(255, Math.max(0, Math.round(b))),
		a: clamp01(a),
	};
};

const rgbaString = (c: ParsedRgba, alpha?: number) => {
	const a = alpha == null ? c.a : clamp01(alpha);
	return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
};

const prefersReducedMotion = () => {
	if (typeof window === "undefined") return false;
	return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
};

export default function Squares({
	className,
	direction = "diagonal",
	borderColor = "rgba(63, 63, 70, 0.2)",
	hoverIntensity = 0.5,
	cellSize = 44,
}: SquaresProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number | null>(null);

	const mouseTargetRef = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });
	const mouseRef = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });

	const baseColor = useMemo(
		() =>
			parseRgba(borderColor, {
				r: 63,
				g: 63,
				b: 70,
				a: 0.2,
			}),
		[borderColor],
	);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const reducedMotion = prefersReducedMotion();
		const intensity = clamp01(Number(hoverIntensity) || 0);
		const effectiveCellSize = Math.max(18, Math.round(Number(cellSize) || 44));

		const resizeToElement = () => {
			const { width, height } = canvas.getBoundingClientRect();
			const dpr = Math.max(1, window.devicePixelRatio || 1);
			canvas.width = Math.max(1, Math.floor(width * dpr));
			canvas.height = Math.max(1, Math.floor(height * dpr));
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const updateMouse = (evt: PointerEvent) => {
			const rect = canvas.getBoundingClientRect();
			const x = evt.clientX - rect.left;
			const y = evt.clientY - rect.top;
			const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
			mouseTargetRef.current = { x, y, inside };
		};

		const onLeave = () => {
			mouseTargetRef.current = { ...mouseTargetRef.current, inside: false };
		};

		const draw = (tMs: number) => {
			const rect = canvas.getBoundingClientRect();
			const width = rect.width;
			const height = rect.height;

			ctx.clearRect(0, 0, width, height);

			const cols = Math.ceil(width / effectiveCellSize);
			const rows = Math.ceil(height / effectiveCellSize);

			// Ease mouse to keep the effect smooth.
			const target = mouseTargetRef.current;
			const cur = mouseRef.current;
			const ease = reducedMotion ? 1 : 0.14;
			cur.x += (target.x - cur.x) * ease;
			cur.y += (target.y - cur.y) * ease;
			cur.inside = target.inside;

			const baseAlpha = baseColor.a;
			const time = tMs / 1000;
			const drift = reducedMotion ? 0 : time * 0.35;

			// A diagonal axis coordinate (x+y) makes the reaction "flow" diagonally.
			const mouseDiag = cur.x + cur.y;
			const sigma = Math.max(120, Math.min(width, height) * 0.18);

			ctx.lineWidth = 1;

			for (let row = 0; row < rows; row += 1) {
				for (let col = 0; col < cols; col += 1) {
					const x = col * effectiveCellSize;
					const y = row * effectiveCellSize;

					const cx = x + effectiveCellSize / 2;
					const cy = y + effectiveCellSize / 2;

					let alpha = baseAlpha;

					if (cur.inside && intensity > 0) {
						let d = 0;
						if (direction === "diagonal") {
							// Distance along the diagonal axis (x+y).
							d = Math.abs(cx + cy - mouseDiag);
						} else if (direction === "horizontal") {
							d = Math.abs(cy - cur.y);
						} else {
							d = Math.abs(cx - cur.x);
						}

						const falloff = Math.exp(-(d * d) / (2 * sigma * sigma));
						// Subtle animated shimmer so the grid feels "alive" but imperceptible.
						const phase = ((cx + cy) / 180 + drift) * Math.PI * 2;
						const shimmer = 0.88 + 0.12 * Math.sin(phase);

						alpha = clamp01(baseAlpha + baseAlpha * intensity * falloff * shimmer);
					}

					ctx.strokeStyle = rgbaString(baseColor, alpha);
					ctx.strokeRect(x + 0.5, y + 0.5, effectiveCellSize, effectiveCellSize);
				}
			}

			rafRef.current = window.requestAnimationFrame(draw);
		};

		resizeToElement();
		rafRef.current = window.requestAnimationFrame(draw);

		const ro = new ResizeObserver(() => {
			resizeToElement();
		});
		ro.observe(canvas);

		canvas.addEventListener("pointermove", updateMouse, { passive: true });
		canvas.addEventListener("pointerdown", updateMouse, { passive: true });
		canvas.addEventListener("pointerleave", onLeave, { passive: true });

		return () => {
			ro.disconnect();
			canvas.removeEventListener("pointermove", updateMouse);
			canvas.removeEventListener("pointerdown", updateMouse);
			canvas.removeEventListener("pointerleave", onLeave);
			if (rafRef.current != null) {
				window.cancelAnimationFrame(rafRef.current);
			}
		};
	}, [baseColor, cellSize, direction, hoverIntensity]);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden
			className={className ?? "absolute inset-0 h-full w-full"}
		/>
	);
}

