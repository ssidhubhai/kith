import { useState, useEffect } from 'react';

/**
 * Hook to track the mobile Visual Viewport height and keyboard offset.
 * Handles iOS Safari and Android Chrome on-screen keyboard appearance
 * without breaking the document layout or causing page jumps.
 */
export function useVisualViewport(): {
  viewportHeight: number | null;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
} {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const vv = window.visualViewport;

    const handleResize = () => {
      // Calculate keyboard height if visual viewport is smaller than window.innerHeight
      const currentHeight = vv.height;
      const windowHeight = window.innerHeight;
      const diff = windowHeight - currentHeight;

      // On mobile keyboards, diff is typically > 150px
      const isKeyboard = diff > 150;
      setViewportHeight(currentHeight);
      setKeyboardHeight(isKeyboard ? diff : 0);
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  return {
    viewportHeight,
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > 0
  };
}
