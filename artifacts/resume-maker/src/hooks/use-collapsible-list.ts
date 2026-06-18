import { useCallback, useState } from "react";

/**
 * Manages expand/collapse UI state for a list of editable blocks
 * (work experience, projects, education, certifications).
 *
 * Expansion state is kept *separate* from the persisted data arrays on purpose:
 * it must never leak into what gets serialized to the API, nor into change
 * detection (e.g. profile's `hasUnsavedChanges()` JSON diff).
 *
 * Indices are used as the identity key. Existing blocks start collapsed; newly
 * added blocks open expanded. Deletions shift the tracked indices so expansion
 * stays aligned with the (now shorter) list.
 */
export function useCollapsibleList() {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const isExpanded = useCallback((i: number) => expanded.has(i), [expanded]);

  const expand = useCallback((i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  }, []);

  const collapse = useCallback((i: number) => {
    setExpanded((prev) => {
      if (!prev.has(i)) return prev;
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  }, []);

  const toggle = useCallback((i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  /**
   * Call when appending a new block. Pass the list length *before* the append;
   * the new block lives at that index and is opened for editing.
   */
  const handleAdd = useCallback((prevLength: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(prevLength);
      return next;
    });
  }, []);

  /** Call after removing the block at `removedIndex`; shifts higher indices down by one. */
  const handleRemove = useCallback((removedIndex: number) => {
    setExpanded((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < removedIndex) next.add(i);
        else if (i > removedIndex) next.add(i - 1);
      });
      return next;
    });
  }, []);

  return { isExpanded, expand, collapse, toggle, handleAdd, handleRemove };
}
