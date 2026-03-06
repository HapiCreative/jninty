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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task, bar },
    });

  const togglePopover = useCallback(() => {
    setShowPopover((prev) => {
      if (!prev && wrapperRef.current) {
        // Capture anchor position when opening
        setAnchorRect(wrapperRef.current.getBoundingClientRect());
      }
      return !prev;
    });
  }, []);

  // Close popover on outside click, Escape key, or scroll
  useEffect(() => {
    if (!showPopover) return;
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      const inWrapper = wrapperRef.current?.contains(target);
      const inPopover = popoverRef.current?.contains(target);
      if (!inWrapper && !inPopover) {
        setShowPopover(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowPopover(false);
    }
    function handleScroll() {
      setShowPopover(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    // Close on any scroll in the timeline container
    const scrollContainer = wrapperRef.current?.closest(".overflow-x-auto");
    scrollContainer?.addEventListener("scroll", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      scrollContainer?.removeEventListener("scroll", handleScroll);
    };
  }, [showPopover]);

  // Close popover when drag starts
  useEffect(() => {
    if (isDragging) setShowPopover(false);
  }, [isDragging]);

  // CSS Grid positioning: 1-based column start, spanning the correct number of days
  const gridColumn = `${startDay} / span ${span}`;

  const barStyle: React.CSSProperties = {
    backgroundColor: color,
    opacity: isDragging ? 0.4 : task.isCompleted ? 0.5 : 1,
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          zIndex: 50,
          position: "relative" as const,
        }
      : {}),
  };

  return (
    // Outer wrapper owns the grid position; contains both draggable bar and info button as siblings
    <div ref={wrapperRef} className="relative" style={{ gridColumn }}>
      {/* Draggable bar — dnd-kit listeners only apply here */}
      <div
        ref={setNodeRef}
        className={`flex min-w-0 cursor-grab items-center gap-1 overflow-visible rounded-md py-1 pl-6 pr-1.5 text-[11px] font-medium leading-tight text-white shadow-sm active:cursor-grabbing ${
          task.isCompleted ? "line-through decoration-white/50" : ""
        }`}
        style={barStyle}
        title={`${task.title} — ${task.scheduledDate}`}
        {...listeners}
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
      </div>

      {/* Info button — sibling of draggable, so dnd-kit cannot intercept */}
      <button
        type="button"
        onClick={togglePopover}
        className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full p-0.5 text-white opacity-70 transition-opacity hover:bg-white/20 hover:opacity-100"
        aria-label={`Details for ${task.cropName} ${label}`}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {/* Popover — rendered via portal to escape overflow clipping */}
      {showPopover && anchorRect && (
        <TimelineBarPopover
          ref={popoverRef}
          task={task}
          anchorRect={anchorRect}
          onToggleComplete={onToggleComplete}
          onClose={() => setShowPopover(false)}
        />
      )}
    </div>
  );
}
