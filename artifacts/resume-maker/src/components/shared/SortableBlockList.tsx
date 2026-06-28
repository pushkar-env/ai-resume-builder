import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

interface SortableListProps<T> {
  items: T[];
  onReorder: (newItems: T[]) => void;
  renderItem: (
    item: T,
    index: number,
    dragProps: {
      ref: (node: HTMLElement | null) => void;
      style: React.CSSProperties;
      dragHandleProps: any;
      onMoveUp?: () => void;
      onMoveDown?: () => void;
    }
  ) => React.ReactNode;
}

export function SortableBlockList<T extends { id: string | number }>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require dragging at least 8px before initiating
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Require 250ms hold time on mobile devices to allow normal scrolling
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const next = [...items];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        onReorder(next);
      }
    }
  };

  const handleMove = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {items.map((item, index) => (
            <SortableItemWrapper
              key={item.id}
              id={item.id}
              index={index}
              total={items.length}
              handleMove={handleMove}
              renderItem={(dragProps) => renderItem(item, index, dragProps)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableItemWrapperProps {
  id: string | number;
  index: number;
  total: number;
  handleMove: (from: number, to: number) => void;
  renderItem: (dragProps: {
    ref: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
    dragHandleProps: any;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
  }) => React.ReactNode;
}

function SortableItemWrapper({
  id,
  index,
  total,
  handleMove,
  renderItem,
}: SortableItemWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: transform
      ? CSS.Transform.toString({
          ...transform,
          x: 0,
        })
      : undefined,
    transition,
    opacity: isDragging ? 0.6 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  const dragHandleProps = {
    ...attributes,
    ...listeners,
  };

  return renderItem({
    ref: setNodeRef,
    style,
    dragHandleProps,
    onMoveUp: index > 0 ? () => handleMove(index, index - 1) : undefined,
    onMoveDown: index < total - 1 ? () => handleMove(index, index + 1) : undefined,
  });
}
