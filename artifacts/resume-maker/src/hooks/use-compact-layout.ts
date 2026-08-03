import { useState, useEffect } from "react";

/**
 * True below the builder's `lg` breakpoint, where the editor swaps the desktop
 * icon rail for the stacked layout (bottom tab bar + "Sections" list).
 *
 * 1023.98px is the exact complement of Tailwind's `lg:` (`min-width: 1024px`),
 * so this stays in lockstep with the `lg:hidden` / `hidden lg:flex` classes that
 * render the two layouts. Reading `window.innerWidth` during render instead
 * leaves the JS branch stale after a tablet rotates — CSS swaps the layout but
 * React never re-renders, so the section list can disappear entirely.
 */
const COMPACT_LAYOUT_QUERY = "(max-width: 1023.98px)";

export function useCompactLayout() {
  const [compact, setCompact] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(COMPACT_LAYOUT_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const sync = () => setCompact(mq.matches);
    // Re-sync on mount in case the viewport changed before the listener attached.
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return compact;
}
