import { useState, useEffect, useRef } from 'react';

/**
 * Hook to track the mobile Visual Viewport height and keyboard offset.
 * Batches and throttles resize events using requestAnimationFrame to prevent
 * layout thrashing and repeated React tree re-renders during keyboard animation.
 */
export function useVisualViewport(): {
  viewportHeight: number | null;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
} {
  const [viewportHeight, setViewportHeight] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      return window.visualViewport.height;
    }
    return null;
  });
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const prevHeightRef = useRef<number | null>(viewportHeight);
  const prevKeyboardRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const vv = window.visualViewport;

    const performMeasurement = () => {
      rafIdRef.current = null;
      if (vv) {
        const currentHeight = Math.round(vv.height);
        const windowHeight = window.innerHeight;
        const diff = Math.max(0, windowHeight - currentHeight);
        const isKeyboard = diff > 140;
        const targetKeyboardHeight = isKeyboard ? diff : 0;

        // Only dispatch state updates if measured value changed by more than 1px
        const heightChanged = prevHeightRef.current === null || Math.abs(prevHeightRef.current - currentHeight) > 1;
        const keyboardChanged = Math.abs(prevKeyboardRef.current - targetKeyboardHeight) > 1;

        if (heightChanged) {
          prevHeightRef.current = currentHeight;
          setViewportHeight(currentHeight);
        }

        if (keyboardChanged) {
          prevKeyboardRef.current = targetKeyboardHeight;
          setKeyboardHeight(targetKeyboardHeight);
        }
      } else {
        const winHeight = window.innerHeight;
        if (prevHeightRef.current !== winHeight) {
          prevHeightRef.current = winHeight;
          setViewportHeight(winHeight);
          setKeyboardHeight(0);
        }
      }
    };

    const scheduleUpdate = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = window.requestAnimationFrame(performMeasurement);
    };

    if (vv) {
      vv.addEventListener('resize', scheduleUpdate, { passive: true });
      vv.addEventListener('scroll', scheduleUpdate, { passive: true });
    }
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    scheduleUpdate();

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
      if (vv) {
        vv.removeEventListener('resize', scheduleUpdate);
        vv.removeEventListener('scroll', scheduleUpdate);
      }
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  return {
    viewportHeight,
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > 0
  };
}
