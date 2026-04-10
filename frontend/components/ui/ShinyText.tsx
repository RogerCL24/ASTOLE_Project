"use client";

import React from "react";

export type ShinyTextProps = {
	children: React.ReactNode;
	className?: string;
	color?: string;
	speed?: number;
};

const KEYFRAMES = `
@keyframes shinyTextSlide {
	0% { background-position: 0% 50%; }
	100% { background-position: 200% 50%; }
}
`;

export default function ShinyText({
	children,
	className,
	color = "#D18400",
	speed = 3,
}: ShinyTextProps) {
	const durationSeconds = Number.isFinite(speed) ? Math.max(0.6, speed) : 3;

	return (
		<>
			<style>{KEYFRAMES}</style>
			<span
				className={`inline-block bg-clip-text text-transparent ${className ?? ""}`}
				style={{
					backgroundImage: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,0.92) 20%, ${color} 45%, ${color} 100%)`,
					backgroundSize: "200% 100%",
					animation: `shinyTextSlide ${durationSeconds}s linear infinite`,
				}}
			>
				{children}
			</span>
		</>
	);
}
