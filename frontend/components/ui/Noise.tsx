"use client";

import React from "react";

export type NoiseProps = {
	className?: string;
};

export default function Noise({ className }: NoiseProps) {
	return (
		<svg
			aria-hidden
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 200 200"
			preserveAspectRatio="none"
		>
			<filter id="noiseFilter">
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.8"
					numOctaves="4"
					stitchTiles="stitch"
				/>
			</filter>
			<rect width="200" height="200" filter="url(#noiseFilter)" opacity="1" />
		</svg>
	);
}
