/**
 * Test-only fixture for e2e/tablet-dnd.spec.ts.
 *
 * Mounts the real builder rail / mobile section items with the real sensors so
 * Playwright can drive them under touch emulation. The builder itself sits
 * behind Clerk auth, which the e2e app shell redirects away, so this is the
 * only way to exercise those components end to end. Reachable solely via
 * e2e/fixtures/tablet-sortable.html, which is not a production build input.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortableSensors } from "../hooks/use-sortable-sensors";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
// The real components under test.
import { SortableRailItem, SortableSectionMobileItem } from "../pages/builder";
import "../index.css";

type S = { id: number; type: string; title: string; isVisible: boolean; displayOrder: number; content: unknown };

const SECTIONS: S[] = [
  { id: 1, type: "summary", title: "Summary", isVisible: true, displayOrder: 0, content: {} },
  { id: 2, type: "experience", title: "Experience", isVisible: true, displayOrder: 1, content: {} },
  { id: 3, type: "education", title: "Education", isVisible: true, displayOrder: 2, content: {} },
  { id: 4, type: "skills", title: "Skills", isVisible: true, displayOrder: 3, content: {} },
];

function Harness({ variant }: { variant: "rail" | "mobile" }) {
  const [sections, setSections] = useState<S[]>(SECTIONS);
  const [selected, setSelected] = useState<number | null>(null);

  // The very same hook BuilderPage uses, so this can't drift from the app.
  const sensors = useSortableSensors();

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const from = prev.findIndex((s) => s.id === active.id);
      const to = prev.findIndex((s) => s.id === over.id);
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  return (
    <div
      data-variant={variant}
      data-order={sections.map((s) => s.id).join("")}
      data-selected={selected === null ? "" : String(selected)}
      className={variant === "rail" ? "w-[76px] border-r border-border bg-muted/10 flex flex-col items-center" : "w-[360px] p-4"}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className={variant === "rail" ? "space-y-2.5 w-full flex flex-col items-center py-4" : "space-y-2"}>
            {sections.map((s) =>
              variant === "rail" ? (
                <SortableRailItem
                  key={s.id}
                  section={s as never}
                  isActive={selected === s.id}
                  onSelect={() => setSelected(s.id)}
                />
              ) : (
                <SortableSectionMobileItem
                  key={s.id}
                  section={s as never}
                  isActive={selected === s.id}
                  onSelect={() => setSelected(s.id)}
                />
              ),
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function App() {
  return (
    <div className="flex gap-10 items-start">
      <Harness variant="rail" />
      <Harness variant="mobile" />
      <div
        data-media
        data-coarse={String(matchMedia("(pointer: coarse)").matches)}
        data-hover={String(matchMedia("(hover: hover)").matches)}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
