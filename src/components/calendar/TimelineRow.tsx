import { useMemo, useCallback } from "react";
import { format } from "date-fns";
import { useDroppable } from "@dnd-kit/core";
import TimelineBarComponent from "./TimelineBar.tsx";
import { groupBarsBySchedule } from "../../hooks/useTimelineData.ts";
import type { MonthRow } from "../../hooks/useTimelineData.ts";
import type { TaskFilterState } from "../../hooks/useTaskFilter.ts";

interface TimelineRowProps {
  row: MonthRow;
  filter: TaskFilterState;
  placementMode?: boolean;
  onDayClick?: (date: string) => void;
}

function DroppableDayCell({
  dateStr,
  day,
  isToday,
  isEven,
  placementMode,
  onDayClick,
}: {
  dateStr: string;
  day: number;
  isToday: boolean;
  isEven: boolean;
  placementMode: boolean;
  onDayClick: (date: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${dateStr}`,
    data: { date: dateStr },
  });

  return (
    <div
      ref={setNodeRef}
      role={placementMode ? "button" : undefined}
      tabIndex={placementMode ? 0 : undefined}
      onClick={() => {
        if (placementMode) onDayClick(dateStr);
      }}
      onKeyDown={(e) => {
        if (placementMode && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onDayClick(dateStr);
        }
      }}
      data-today={isToday ? "" : undefined}
      className={`relative border-r border-border-default px-0.5 py-0.5 text-center text-[10px] leading-tight ${
        isToday
          ? "bg-green-100 font-bold text-green-800"
          : isEven
            ? "bg-surface text-text-muted"
            : "bg-surface-elevated text-text-muted"
      } ${placementMode ? "cursor-crosshair hover:bg-green-50 hover:text-green-700" : ""} ${
        isOver ? "!bg-blue-100 ring-2 ring-inset ring-blue-400" : ""
      }`}
    >
      {day}
      {isToday && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-green-500" />
      )}
    </div>
  );
}

export default function TimelineRow({
  row,
  filter,
  placementMode,
  onDayClick,
}: TimelineRowProps) {
  const { monthDate, label, daysInMonth, bars, hasToday, todayDay } = row;

  // Filter bars by task type visibility
  const visibleBars = useMemo(
    () => bars.filter((b) => filter.isVisible(b.task.taskType)),
    [bars, filter],
  );

  // Group bars by schedule for row stacking
  const scheduleGroups = useMemo(
    () => groupBarsBySchedule(visibleBars),
    [visibleBars],
  );

  // Build day number headers
  const dayHeaders = useMemo(() => {
    const headers: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      headers.push(d);
    }
    return headers;
  }, [daysInMonth]);

  // Build ISO date string for a given day in this month
  const getDateString = useCallback(
    (day: number): string => {
      const d = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        day,
      );
      return format(d, "yyyy-MM-dd");
    },
    [monthDate],
  );

  const handleDayClick = useCallback(
    (date: string) => {
      if (!placementMode || !onDayClick) return;
      onDayClick(date);
    },
    [placementMode, onDayClick],
  );

  return (
    <div className="flex border-b border-border-default">
      {/* Month label — sticky left */}
      <div className="sticky left-0 z-10 flex w-16 shrink-0 flex-col justify-center border-r border-border-default bg-surface-elevated px-2 py-1">
        <span className="text-xs font-semibold text-text-heading leading-tight">
          {label.split(" ")[0]}
        </span>
        <span className="text-[10px] text-text-secondary leading-tight">
          {label.split(" ")[1]}
        </span>
      </div>

      {/* Day columns + bars */}
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${daysInMonth}, minmax(28px, 1fr))`,
          }}
        >
          {/* Day number headers — droppable targets */}
          {dayHeaders.map((d) => {
            const dateStr = getDateString(d);
            return (
              <DroppableDayCell
                key={d}
                dateStr={dateStr}
                day={d}
                isToday={hasToday && todayDay === d}
                isEven={d % 2 === 0}
                placementMode={placementMode ?? false}
                onDayClick={handleDayClick}
              />
            );
          })}

          {/* Bar rows — one row per schedule group */}
          {[...scheduleGroups.entries()].map(([scheduleId, groupBars]) => (
            <div
              key={scheduleId}
              className="col-span-full grid"
              style={{
                gridTemplateColumns: `repeat(${daysInMonth}, minmax(28px, 1fr))`,
              }}
            >
              {groupBars.map((bar) => (
                <TimelineBarComponent
                  key={bar.task.id}
                  bar={bar}
                />
              ))}
            </div>
          ))}

          {/* Empty state for months with no visible bars */}
          {scheduleGroups.size === 0 && (
            <div className="col-span-full h-6" />
          )}
        </div>
      </div>
    </div>
  );
}
