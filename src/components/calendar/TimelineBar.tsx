import { useDraggable } from "@dnd-kit/core";
import { TASK_TYPE_COLORS, TASK_TYPE_LABELS } from "./taskTypeColors.ts";
import type { TimelineBar as TimelineBarType } from "../../hooks/useTimelineData.ts";

interface TimelineBarProps {
  bar: TimelineBarType;
}

export default function TimelineBarComponent({ bar }: TimelineBarProps) {
  const { task, startDay, endDay } = bar;
  const color = TASK_TYPE_COLORS[task.taskType];
  const label = TASK_TYPE_LABELS[task.taskType];
  const span = endDay - startDay + 1;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task, bar },
    });

  // CSS Grid positioning: 1-based column start, spanning the correct number of days
  const gridColumn = `${startDay} / span ${span}`;

  const style: React.CSSProperties = {
    gridColumn,
    backgroundColor: color,
    opacity: isDragging ? 0.4 : 1,
    // Apply drag transform
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          zIndex: 50,
          position: "relative" as const,
        }
      : {}),
  };

  return (
    <div
      ref={setNodeRef}
      className="flex min-w-0 cursor-grab items-center gap-1 overflow-hidden rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white active:cursor-grabbing"
      style={style}
      title={`${task.title} — ${task.scheduledDate}`}
      {...listeners}
      {...attributes}
    >
      <span className="shrink-0 opacity-80">{label}</span>
      <span className="truncate">{task.cropName}</span>
      {task.bedName && (
        <span className="ml-auto shrink-0 truncate opacity-70">
          {task.bedName}
        </span>
      )}
    </div>
  );
}
