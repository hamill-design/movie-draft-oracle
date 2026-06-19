import { useCallback, useEffect, useRef } from 'react';
import type { Application } from '@splinetool/react-spline';

interface UseSplineViewportPauseOptions {
  /**
   * Distance outside the viewport (in px) at which the scene starts playing,
   * so it's already running by the time it scrolls into view.
   */
  rootMargin?: string;
  /**
   * Called whenever the scene enters or leaves the viewport. Use this to pause
   * any companion animation loops (e.g. a requestAnimationFrame tick) the
   * component runs alongside the Spline scene.
   */
  onVisibilityChange?: (visible: boolean) => void;
}

/**
 * Pauses a Spline (WebGL) scene's render loop while it is scrolled off-screen
 * and resumes it when it scrolls back into view. Each Spline scene is a
 * continuously rendering 3D engine, so leaving several mounted at once keeps the
 * GPU busy even for scenes the user can't see — the main cause of scroll jank
 * on pages with multiple scenes.
 *
 * Usage:
 *   const { containerRef, handleLoad } = useSplineViewportPause();
 *   <div ref={containerRef}>
 *     <Spline scene="..." onLoad={handleLoad} />
 *   </div>
 */
export function useSplineViewportPause<T extends HTMLElement>(
  options: UseSplineViewportPauseOptions = {}
) {
  const { rootMargin = '200px', onVisibilityChange } = options;

  const appRef = useRef<Application | null>(null);
  // Assume visible until the observer reports otherwise, so above-the-fold
  // scenes play immediately on load without waiting for an intersection change.
  const visibleRef = useRef(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  onVisibilityChangeRef.current = onVisibilityChange;

  const apply = useCallback(() => {
    const app = appRef.current;
    if (app) {
      if (visibleRef.current) app.play();
      else app.stop();
    }
    onVisibilityChangeRef.current?.(visibleRef.current);
  }, []);

  // Called from <Spline onLoad>; captures the runtime instance and applies the
  // current visibility state (the scene may already be off-screen by load time).
  const handleLoad = useCallback(
    (app: Application) => {
      appRef.current = app;
      apply();
    },
    [apply]
  );

  // Callback ref so it works for scenes that mount conditionally (e.g. desktop
  // only): React calls it with the node on mount and null on unmount.
  const containerRef = useCallback(
    (el: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!el || typeof IntersectionObserver === 'undefined') return;

      const observer = new IntersectionObserver(
        (entries) => {
          const isVisible = entries.some((entry) => entry.isIntersecting);
          if (isVisible === visibleRef.current) return;
          visibleRef.current = isVisible;
          apply();
        },
        { rootMargin }
      );
      observer.observe(el);
      observerRef.current = observer;
    },
    [apply, rootMargin]
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { containerRef, handleLoad };
}
