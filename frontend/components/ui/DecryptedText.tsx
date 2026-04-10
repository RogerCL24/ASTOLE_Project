"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type DecryptedTextAnimateOn = "view" | "mount" | "hover";

export type DecryptedTextProps = {
	text: string;
	className?: string;
	animateOn?: DecryptedTextAnimateOn;
	revealDuration?: number;
	sequential?: boolean;
	characters?: string;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const prefersReducedMotion = () => {
	if (typeof window === "undefined") return false;
	return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
};

const pick = (alphabet: string[], rng: () => number) => {
	if (!alphabet.length) return "";
	return alphabet[Math.floor(rng() * alphabet.length)] ?? "";
};

export default function DecryptedText({
	text,
	className,
	animateOn = "mount",
	revealDuration = 0.8,
	sequential = true,
	characters = "0101X?#&.",
}: DecryptedTextProps) {
	const value = String(text ?? "");
	const [display, setDisplay] = useState(value);
	const wrapperRef = useRef<HTMLSpanElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const hasAnimatedRef = useRef(false);
	const hoverArmedRef = useRef(false);

	const alphabet = useMemo(() => {
		const raw = String(characters ?? "");
		const chars = raw.split("").filter(Boolean);
		return chars.length ? chars : "0101X?#&.".split("");
	}, [characters]);

	const runAnimation = () => {
		if (hasAnimatedRef.current) return;
		hasAnimatedRef.current = true;

		const reducedMotion = prefersReducedMotion();
		const durationMs = Math.max(50, Number(revealDuration) * 1000);
		const start = performance.now();
		const rng = Math.random;

		const source = value;
		const len = source.length;

		const renderFrame = (t: number) => {
			const p = clamp01((t - start) / durationMs);

			if (reducedMotion) {
				setDisplay(source);
				return;
			}

			const revealCount = sequential ? Math.floor(p * len) : len;

			let out = "";
			for (let i = 0; i < len; i += 1) {
				const ch = source[i] ?? "";
				if (ch === " ") {
					out += " ";
					continue;
				}

				const isRevealed = sequential ? i < revealCount : p >= 1;
				out += isRevealed ? ch : pick(alphabet, rng);
			}

			setDisplay(out);

			if (p < 1) {
				rafRef.current = window.requestAnimationFrame(renderFrame);
			} else {
				setDisplay(source);
			}
		};

		rafRef.current = window.requestAnimationFrame(renderFrame);
	};

	useEffect(() => {
		setDisplay(value);
		hasAnimatedRef.current = false;
		hoverArmedRef.current = false;
		return () => {
			if (rafRef.current != null) {
				window.cancelAnimationFrame(rafRef.current);
			}
		};
	}, [value]);

	useEffect(() => {
		const el = wrapperRef.current;
		if (!el) return;

		if (animateOn === "mount") {
			runAnimation();
			return;
		}

		if (animateOn === "hover") {
			const onEnter = () => {
				hoverArmedRef.current = true;
				runAnimation();
			};
			el.addEventListener("pointerenter", onEnter, { passive: true });
			return () => {
				el.removeEventListener("pointerenter", onEnter);
			};
		}

		if (animateOn === "view") {
			const observer = new IntersectionObserver(
				(entries) => {
					const entry = entries[0];
					if (!entry) return;
					if (entry.isIntersecting) {
						runAnimation();
						observer.disconnect();
					}
				},
				{ threshold: 0.35 },
			);
			observer.observe(el);
			return () => observer.disconnect();
		}
	}, [animateOn]);

	return (
		<span ref={wrapperRef} className={className}>
			<span aria-hidden>{display}</span>
			<span className="sr-only">{value}</span>
		</span>
	);
}

