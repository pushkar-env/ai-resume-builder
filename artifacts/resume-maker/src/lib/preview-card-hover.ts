/**
 * Shared hover motion for template grid cards and dashboard resume cards.
 */
export const previewCardHoverTransition = {
  type: "spring" as const,
  stiffness: 460,
  damping: 38,
};

/** Subtle lift — slightly stronger than pure CSS-only, still minimal. */
export const previewCardWhileHover = {
  y: -4,
  scale: 1.012,
};

export const previewCardWhileTap = {
  scale: 0.992,
};
