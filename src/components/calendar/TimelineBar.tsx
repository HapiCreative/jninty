import { useState, useCallback, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { TASK_TYPE_COLORS, TASK_TYPE_LABELS } from "./taskTypeColors.ts";
import TimelineBarPopover from "./TimelineBarPopover.tsx";
import type { TimelineBar as TimelineBarType } from "../../hooks/useTimelineData.ts";

interface TimelineBarProps {
  bar: TimelineBarType;
  onToggleComplete: (taskId: string) => void;
}

export default function TimelineBarComponent({ bar, onToggleComplete }: TimelineBarProps) {
  const { task, startDay, endDay } = bar;
  const color = TASK_TYPE_COLORS[task.taskType];
  const label = TASK_TYPE_LABELS[task.taskType];
  const span = endDay - startDay + 1;

  const [showPopover, setShowPopover] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task, bar },
    });

  // Combine refs: dnd-kit + our local ref
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      (barRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [setNodeRef],
  );

  // Track pointer start to distinguish click from drag.
  // dnd-kit's listeners capture onPointerDown, so onClick doesn't fire reliably.
  // Instead, we record the start position and check distance on pointerUp.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      // Forward to dnd-kit's handler
      const dndHandler = listeners?.onPointerDown as
        | ((e: React.PointerEvent<HTMLDivElement>) => void)
        | undefined;
      dndHandler?.(e);
    },
    [listeners],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (!start || isDragging) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.sqrt(dx * dx + dy * dy) < 8) {
        setShowPopover((prev) => !prev);
      }
    },
    [isDragging],
  );

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    function handleOutsideClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showPopover]);

  // Close popover when drag starts
  useEffect(() => {
    if (isDragging) setShowPopover(false);
  }, [isDragging]);

  // CSS Grid positioning: 1-based column start, spanning the correct number of days
  const gridColumn = `${startDay} / span ${span}`;

  const style: React.CSSProperties = {
    gridColumn,
    backgroundColor: color,
    opacity: isDragging ? 0.4 : task.isCompleted ? 0.5 : 1,
    // Apply drag transform
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          zIndex: 50,
          position: "relative" as const,
        }
      : {}),
  };

  // Spread dnd-kit listeners but replace onPointerDown with our wrapper
  const { onPointerDown: _dndPointerDown, ...restListeners } = listeners ?? {};

  return (
    <div
      ref={setRefs}
      className={`relative flex min-w-0 cursor-grab items-center gap-1.5 overflow-visible rounded-md px-2 py-1 text-[11px] font-medium leading-tight text-white shadow-sm active:cursor-grabbing ${
        task.isCompleted ? "line-through decoration-white/50" : ""
      }`}
      style={style}
      title={`${task.title} — ${task.scheduledDate}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      {...restListeners}
      {...attributes}
    >
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </span>
      <span className="truncate">
        {task.cropName}
        {span >= 4 && task.varietyName && (
          <span className="ml-1 opacity-70">({task.varietyName})</span>
        )}
      </span>
      {task.bedName && (
        <span className="ml-auto shrink-0 truncate text-[10px] opacity-70">
          {task.bedName}
        </span>
      )}

      {showPopover && (
        <TimelineBarPopover
          task={task}
          onToggleComplete={onToggleComplete}
          onClose={() => setShowPopover(false)}
        />
      )}
    </div>
  );
}
