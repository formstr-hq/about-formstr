import { useEffect, useState } from "react";
import type { RefObject } from "react";

/* ------------------------------------------------------------------ */
/* Small math helpers shared with the 3D scene                         */
/* ------------------------------------------------------------------ */

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Smooth 0→1 ramp between edges e0 and e1 (Hermite smoothstep). */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** A 0→1→0 "band" that fades in over [a,b], holds, and fades out over [c,d]. */
export function band(a: number, b: number, c: number, d: number, x: number) {
  return smoothstep(a, b, x) * (1 - smoothstep(c, d, x));
}

/* ------------------------------------------------------------------ */
/* Capability detection — decides whether the WebGL hero may run.      */
/* Always false during SSR and the first client paint (mounted=false), */
/* so the prerendered static hero and the first hydrated render match. */
/* ------------------------------------------------------------------ */

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/** The 3D scene is a motion-OK, WebGL-capable experience (desktop + mobile). */
export function canRender3D(): boolean {
  if (typeof window === "undefined") return false;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return false;
  // The scene runs on phones too (touch-scroll drives the acts); the only
  // gates are motion preference and WebGL support.
  return webglAvailable();
}

/**
 * Returns whether the 3D hero should mount. Starts `false` (SSR-safe), then
 * re-evaluates after mount and on resize so crossing the breakpoint toggles it.
 */
export function useCanRender3D(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const evaluate = () => setOk(canRender3D());
    evaluate();
    window.addEventListener("resize", evaluate, { passive: true });
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener?.("change", evaluate);
    return () => {
      window.removeEventListener("resize", evaluate);
      mq.removeEventListener?.("change", evaluate);
    };
  }, []);
  return ok;
}

/* ------------------------------------------------------------------ */
/* Scroll progress — native scroll, no library scroll hijacking.       */
/* Mirrors the rAF + passive-listener pattern in useScrollFx (App.tsx).*/
/* Writes progress into a ref (read by useFrame, no React re-renders)  */
/* and sets per-act opacity CSS vars on the hero element for the       */
/* HTML copy overlays.                                                 */
/* ------------------------------------------------------------------ */

export function useHeroScroll(
  heroRef: RefObject<HTMLElement | null>,
  progressRef: RefObject<number>,
  active: boolean,
) {
  useEffect(() => {
    const el = heroRef.current;
    if (!el || !active) return;

    let raf = 0;
    const apply = () => {
      raf = 0;
      const total = el.offsetHeight - window.innerHeight;
      const scrolled = -el.getBoundingClientRect().top;
      const p = total > 0 ? clamp01(scrolled / total) : 0;
      progressRef.current = p;

      // Per-act overlay opacities. Acts overlap slightly so copy cross-fades.
      el.style.setProperty("--p", p.toFixed(4));
      el.style.setProperty("--act1", band(-1, 0, 0.24, 0.34, p).toFixed(4));
      el.style.setProperty("--act2", band(0.3, 0.4, 0.56, 0.64, p).toFixed(4));
      el.style.setProperty("--act3", smoothstep(0.66, 0.76, p).toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [heroRef, progressRef, active]);
}
