import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * Shared dnd-kit sensors for every sortable list in the app.
 *
 * MouseSensor rather than PointerSensor is the important part: touch fires
 * `pointerdown` as well as `touchstart`, so registering PointerSensor alongside
 * TouchSensor let the pointer sensor claim every touch and the hold-to-drag
 * constraint below never ran — a short swipe reordered the list instead of
 * scrolling it. Splitting mouse from touch gives each input its own gesture.
 * Pen still works: browsers emit compatibility mouse events for pen, but not
 * for touch mid-gesture.
 */
export function useSortableSensors({
  /** Mouse: pixels of travel before a drag begins. */
  distance = 8,
  /** Touch: hold time before a drag begins, so scrolling stays the default. */
  delay = 220,
  /** Touch: movement allowed during the hold before activation is cancelled. */
  tolerance = 8,
}: { distance?: number; delay?: number; tolerance?: number } = {}) {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance } }),
    useSensor(TouchSensor, { activationConstraint: { delay, tolerance } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
