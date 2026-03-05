import { useState, useCallback } from "react";
import CalendarViewSwitcher, {
  type CalendarView,
} from "../components/calendar/CalendarViewSwitcher.tsx";
import TimelineView from "../components/calendar/TimelineView.tsx";
import YearlyView from "../components/calendar/YearlyView.tsx";
import PlantingCalendarPage from "./PlantingCalendarPage.tsx";

export default function CalendarPage() {
  const [activeView, setActiveView] = useState<CalendarView>("timeline");

  // When drilling from yearly view into a specific month
  const handleDrillToMonth = useCallback((_year: number, _month: number) => {
    // Switch to monthly view — PlantingCalendarPage manages its own month state
    // so we just switch the tab; a future enhancement could pass the target month
    setActiveView("monthly");
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="font-display text-2xl font-bold text-text-heading">
          Calendar
        </h1>
        <CalendarViewSwitcher
          activeView={activeView}
          onViewChange={setActiveView}
        />
      </div>

      {/* View content */}
      <div className="mt-3">
        {activeView === "timeline" && <TimelineView />}
        {activeView === "monthly" && <PlantingCalendarPage />}
        {activeView === "yearly" && (
          <YearlyView onDrillToMonth={handleDrillToMonth} />
        )}
      </div>
    </div>
  );
}
