import { useCallback, useState } from "react";

/**
 * Manages expand/collapse UI state for a list of editable blocks
 * (work experience, projects, education, certifications).
 *
 * Expansion state is kept *separate* from the persisted data arrays on purpose:
 * it must never leak into what gets serialized to the API, nor into change
 * detection (e.g. profile's `hasUnsavedChanges()` JSON diff).
 *
 * Unique keys (string | number) are used as the identity key. Existing blocks start collapsed;
 * newly added blocks open expanded.
 */
export function useCollapsibleList() {
  const [expanded, setExpanded] = useState<Set<string | number>>(() => new Set());

  const isExpanded = useCallback((key: string | number) => expanded.has(key), [expanded]);

  const expand = useCallback((key: string | number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const collapse = useCallback((key: string | number) => {
    setExpanded((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const toggle = useCallback((key: string | number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /**
   * Call when appending a new block. Pass the unique key of the new block
   * so it is opened for editing.
   */
  const handleAdd = useCallback((key: string | number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  /** Call after removing the block with the given unique key. */
  const handleRemove = useCallback((key: string | number) => {
    setExpanded((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  return { isExpanded, expand, collapse, toggle, handleAdd, handleRemove };
}
