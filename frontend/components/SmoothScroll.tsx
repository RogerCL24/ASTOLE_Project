"use client";
import { ReactLenis } from '@studio-freight/react-lenis';

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.08, duration: 1.2 }}>
      {/* @ts-expect-error Conflicto de tipos entre React 18 y 19 */}
      {children}
    </ReactLenis>
  );
}