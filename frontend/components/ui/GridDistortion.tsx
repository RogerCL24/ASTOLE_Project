"use client";

import React, { useEffect, useMemo, useRef } from "react";

export type GridDistortionProps = {
	className?: string;
	backgroundColor?: string;
	lineColor?: string;
	cellSize?: number;
	distortionStrength?: number;
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

export default function GridDistortion({
	className,
	backgroundColor = "#09090b",
	lineColor = "rgba(255, 255, 255, 0.055)",
	cellSize = 48,
	distortionStrength = 0.5,
}: GridDistortionProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const mouseTargetRef = useRef<{ nx: number; ny: number; inside: boolean }>({ nx: 0.5, ny: 0.5, inside: false });
	const mouseRef = useRef<{ nx: number; ny: number; inside: boolean }>({ nx: 0.5, ny: 0.5, inside: false });

	const baseLine = useMemo(
		() =>
			parseRgba(lineColor, {
				r: 255,
				g: 255,
				b: 255,
				a: 0.055,
			}),
		[lineColor],
	);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const reducedMotion = prefersReducedMotion();
		const strength = Math.max(0, Math.min(1, Number(distortionStrength) || 0));
		const step = Math.max(28, Math.round(Number(cellSize) || 48));

		const resizeToElement = () => {
			const { width, height } = canvas.getBoundingClientRect();
			const dpr = Math.max(1, window.devicePixelRatio || 1);
			canvas.width = Math.max(1, Math.floor(width * dpr));
			canvas.height = Math.max(1, Math.floor(height * dpr));
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const updateMouse = (evt: MouseEvent) => {
			const w = Math.max(1, window.innerWidth || 1);
			const h = Math.max(1, window.innerHeight || 1);
			const rawNx = evt.clientX / w;
			const rawNy = evt.clientY / h;
			const nx = clamp01(rawNx);
			const ny = clamp01(rawNy);
			const inside = evt.clientX >= 0 && evt.clientY >= 0 && evt.clientX <= w && evt.clientY <= h;
			mouseTargetRef.current = { nx, ny, inside };
		};

		const onLeave = () => {
			mouseTargetRef.current = { ...mouseTargetRef.current, inside: false };
		};

		const draw = (tMs: number) => {
			const rect = canvas.getBoundingClientRect();
			const width = rect.width;
			const height = rect.height;

			// Background.
			ctx.clearRect(0, 0, width, height);
			ctx.fillStyle = backgroundColor;
			ctx.fillRect(0, 0, width, height);

			// Ease mouse for smooth interaction.
			const target = mouseTargetRef.current;
			const cur = mouseRef.current;
			const ease = reducedMotion ? 1 : 0.14;
			cur.nx += (target.nx - cur.nx) * ease;
			cur.ny += (target.ny - cur.ny) * ease;
			cur.inside = target.inside;

			const cols = Math.ceil(width / step) + 2;
			const rows = Math.ceil(height / step) + 2;

			const time = tMs / 1000;
			const drift = reducedMotion ? 0 : time * 0.6;

			// Distortion envelope around cursor.
			// Intentionally stronger so the effect is clearly visible through translucent cards.
			const sigma = Math.max(110, Math.min(width, height) * 0.18);
			const maxAmp = 28 * strength;

			const pointX: number[] = new Array(cols);
			const pointY: number[] = new Array(rows);
			for (let c = 0; c < cols; c += 1) pointX[c] = (c - 1) * step;
			for (let r = 0; r < rows; r += 1) pointY[r] = (r - 1) * step;

			const fx = (x: number, y: number) => {
				if (!cur.inside || strength <= 0) return 0;
				const mx = cur.nx * width;
				const my = cur.ny * height;
				const dx = x - mx;
				const dy = y - my;
				const d2 = dx * dx + dy * dy;
				return Math.exp(-d2 / (2 * sigma * sigma));
			};

			ctx.lineWidth = 1;

			// Horizontal lines.
			for (let r = 0; r < rows; r += 1) {
				ctx.beginPath();
				for (let c = 0; c < cols; c += 1) {
					const x0 = pointX[c];
					const y0 = pointY[r];
					const influence = fx(x0, y0);
					const wobble = reducedMotion ? 0 : Math.sin(drift + (x0 + y0) / 160) * 0.55;
					const ox = influence * maxAmp * (Math.sin(drift + x0 / 90) * 0.8 + wobble);
					const oy = influence * maxAmp * (Math.cos(drift + y0 / 110) * 0.8 - wobble);
					const x = x0 + ox;
					const y = y0 + oy;
					if (c === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				const alpha = clamp01(baseLine.a + (cur.inside ? 0.06 * strength : 0));
				ctx.strokeStyle = rgbaString(baseLine, alpha);
				ctx.stroke();
			}

			// Vertical lines.
			for (let c = 0; c < cols; c += 1) {
				ctx.beginPath();
				for (let r = 0; r < rows; r += 1) {
					const x0 = pointX[c];
					const y0 = pointY[r];
					const influence = fx(x0, y0);
					const wobble = reducedMotion ? 0 : Math.cos(drift + (x0 - y0) / 180) * 0.55;
					const ox = influence * maxAmp * (Math.sin(drift + x0 / 100) * 0.8 + wobble);
					const oy = influence * maxAmp * (Math.cos(drift + y0 / 85) * 0.8 - wobble);
					const x = x0 + ox;
					const y = y0 + oy;
					if (r === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				const alpha = clamp01(baseLine.a + (cur.inside ? 0.06 * strength : 0));
				ctx.strokeStyle = rgbaString(baseLine, alpha);
				ctx.stroke();
			}

			rafRef.current = window.requestAnimationFrame(draw);
		};

		resizeToElement();
		rafRef.current = window.requestAnimationFrame(draw);

		const ro = new ResizeObserver(() => {
			resizeToElement();
		});
		ro.observe(canvas);

		window.addEventListener("mousemove", updateMouse, { passive: true });
		window.addEventListener("blur", onLeave, { passive: true });

		return () => {
			ro.disconnect();
			window.removeEventListener("mousemove", updateMouse);
			window.removeEventListener("blur", onLeave);
			if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
		};
	}, [backgroundColor, baseLine, cellSize, distortionStrength]);

	const mergedClassName = className
		? `${className} pointer-events-none`
		: "absolute inset-0 h-full w-full pointer-events-none";

	return <canvas ref={canvasRef} aria-hidden className={mergedClassName} />;
}
