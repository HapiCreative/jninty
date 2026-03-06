import { useMemo, useCallback } from "react";
import { format, getDay, parseISO, isSameMonth, getDate, isBefore, isAfter } from "date-fns";
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
  lastFrostDate: string;
  firstFrostDate: string;
  onToggleComplete: (taskId: string) => void;
}

/** Returns true if the given day (1-based) in the month is a Saturday or Sunday */
function isWeekend(monthDate: Date, day: number): boolean {
  const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
  const dow = getDay(date); // 0 = Sunday, 6 = Saturday
  return dow === 0 || dow === 6;
}

type SeasonTint = "winter" | "growing" | "fall";

function getSeasonTint(
  monthDate: Date,
  day: number,
  lastFrostDate: string,
  firstFrostDate: string,
): SeasonTint {
  const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
  const year = monthDate.getFullYear();
  // Normalize frost dates to the row's year for multi-year views
  const lastFrost = parseISO(lastFrostDate.replace(/^\d{4}/, String(year)));
  const firstFrost = parseISO(firstFrostDate.replace(/^\d{4}/, String(year)));

  if (isBefore(date, lastFrost)) return "winter";
  if (isAfter(date, firstFrost)) return "fall";
  return "growing";
}

const SEASON_BG: Record<SeasonTint, string> = {
  winter: "bg-cream-200/40",   // cool cream tint
  growing: "bg-green-50/25",   // soft green tint
  fall: "bg-brown-50/50",      // warm amber tint
};

function DroppableDayCell({
  dateStr,
  day,
  isToday,
  isWeekendDay,
  isFrostDate,
  seasonTint,
  placementMode,
  onDayClick,
}: {
  dateStr: string;
  day: number;
  isToday: boolean;
  isWeekendDay: boolean;
  isFrostDate: boolean;
  seasonTint: SeasonTint;
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
      className={`relative border-r border-border-default px-0.5 py-1 text-center text-xs leading-tight ${
        isToday
          ? "bg-green-50 font-bold text-green-800"
          : isWeekendDay
            ? "bg-brown-100/50 text-text-muted"
            : `${SEASON_BG[seasonTint]} text-text-muted`
      } ${placementMode ? "cursor-crosshair hover:bg-green-50 hover:text-green-700" : ""} ${
        isOver ? "!bg-blue-100 ring-2 ring-inset ring-blue-400" : ""
      }`}
    >
      {isToday ? (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white">
          {day}
        </span>
      ) : (
        day
      )}
      {isFrostDate && (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0 -translate-x-1/2 border-l-2 border-dashed border-terracotta-500/60" />
      )}
    </div>
  );
}

export default function TimelineRow({
  row,
  filter,
  placementMode,
  onDayClick,
  lastFrostDate,
  firstFrostDate,
  onToggleComplete,
}: TimelineRowProps) {
  const { monthDate, label, daysInMonth, bars, hasToday, todayDay } = row;

  // Compute which days (if any) are frost dates for this month
  // Normalize frost date year to match this row for multi-year views
  const lastFrostDay = useMemo(() => {
    const normalized = lastFrostDate.replace(/^\d{4}/, String(monthDate.getFullYear()));
    const d = parseISO(normalized);
    return isSameMonth(d, monthDate) ? getDate(d) : null;
  }, [lastFrostDate, monthDate]);

  const firstFrostDay = useMemo(() => {
    const normalized = firstFrostDate.replace(/^\d{4}/, String(monthDate.getFullYear()));
    const d = parseISO(normalized);
    return isSameMonth(d, monthDate) ? getDate(d) : null;
  }, [firstFrostDate, monthDate]);

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
      <div className="sticky left-0 z-10 flex w-16 shrink-0 flex-col justify-center border-r border-border-default bg-surface-elevated px-2 py-1.5">
        <span className="text-sm font-semibold text-text-heading leading-tight">
          {label.split(" ")[0]}
        </span>
        <span className="text-xs text-text-secondary leading-tight">
          {label.split(" ")[1]}
        </span>
      </div>

      {/* Day columns + bars */}
      <div className="relative min-w-0 flex-1 overflow-x-auto">
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
                isWeekendDay={isWeekend(monthDate, d)}
                isFrostDate={d === lastFrostDay || d === firstFrostDay}
                seasonTint={getSeasonTint(monthDate, d, lastFrostDate, firstFrostDate)}
                placementMode={placementMode ?? false}
                onDayClick={handleDayClick}
              />
            );
          })}

          {/* Bar rows — one row per schedule group */}
          {[...scheduleGroups.entries()].map(([scheduleId, groupBars]) => {
            const sorted = [...groupBars].sort((a, b) => a.startDay - b.startDay);

            return (
              <div
                key={scheduleId}
                className="relative col-span-full grid items-center"
                style={{
                  gridTemplateColumns: `repeat(${daysInMonth}, minmax(28px, 1fr))`,
                }}
              >
                {/* Connector lines between consecutive bars */}
                {sorted.length > 1 &&
                  sorted.slice(0, -1).map((bar, i) => {
                    const nextBar = sorted[i + 1]!;
                    const gapStart = bar.endDay + 1;
                    const gapEnd = nextBar.startDay - 1;
                    if (gapEnd < gapStart) return null;
                    return (
                      <div
                        key={`conn-${bar.task.id}`}
                        className="pointer-events-none flex items-center justify-center"
                        style={{
                          gridColumn: `${gapStart} / ${gapEnd + 1}`,
                        }}
                      >
                        <div className="h-px w-full border-t border-dashed border-brown-300/60" />
                      </div>
                    );
                  })}

                {/* Task bars */}
                {sorted.map((bar) => (
                  <TimelineBarComponent
                    key={bar.task.id}
                    bar={bar}
                    onToggleComplete={onToggleComplete}
                  />
                ))}
              </div>
            );
          })}

          {/* Empty state for months with no visible bars */}
          {scheduleGroups.size === 0 && (
            <div className="col-span-full h-6" />
          )}
        </div>

        {/* Today vertical line spanning full row height */}
        {hasToday && todayDay != null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-green-600"
            style={{
              left: `calc(${((todayDay - 0.5) / daysInMonth) * 100}%)`,
            }}
          />
        )}
      </div>
    </div>
  );
}
