"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Size an element to fill from its own top edge down to the bottom of the
 * viewport, so a chat thread's composer stays on screen without page scroll
 * whatever the header above it costs (portal vs admin, desktop vs mobile, and
 * when the mobile keyboard resizes the viewport). A callback ref measures the
 * moment the element mounts (threads open on demand), and we re-measure on
 * resize. `min` is a floor so the thread stays usable on very short screens.
 */
export function useFillHeight(margin = 24, min = 240) {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const elRef = useRef<HTMLDivElement | null>(null);

  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    setHeight(Math.max(min, window.innerHeight - top - margin));
  }, [margin, min]);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      elRef.current = node;
      if (node) {
        measure();
        window.setTimeout(measure, 60); // re-measure once layout/fonts settle
      }
    },
    [measure],
  );

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return { ref, height };
}
