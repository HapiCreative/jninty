import { useMemo } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { usePouchQuery } from "../../hooks/usePouchQuery.ts";
import { taskRepository, plantRepository, plantingRepository, seasonRepository } from "../../db/index.ts";
import { useSettings } from "../../hooks/useSettings";
import { getBySpecies } from "../../services/knowledgeBase";
import { computePlantingWindows } from "../../services/calendar";
import useOnlineStatus from "../../hooks/useOnlineStatus";
import { useSync } from "../../hooks/useSync";

// SVG icon components — inline to avoid extra dependencies

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PlantIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function JournalIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function TaskIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function SeedNavIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c-4-2-8-7-8-12C4 5.5 7.6 2 12 2s8 3.5 8 8c0 5-4 10-8 12z" />
      <path d="M12 2v10" />
      <path d="M12 12c-2-2-4-4-4-6" />
      <path d="M12 12c2-2 4-4 4-6" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  );
}

function ExpenseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: number;
}

function getPrimaryNav(calendarBadge: number): NavItem[] {
  return [
    { to: "/", label: "Home", icon: HomeIcon },
    { to: "/plants", label: "Plants", icon: PlantIcon },
    // Quick Log is rendered separately (center prominent button)
    { to: "/calendar", label: "Calendar", icon: CalendarIcon, badge: calendarBadge },
    { to: "/map", label: "Map", icon: MapIcon },
  ];
}

function getSecondaryNav(overdueCount: number): NavItem[] {
  return [
    { to: "/journal", label: "Journal", icon: JournalIcon },
    { to: "/seeds", label: "Seed Bank", icon: SeedNavIcon },
    { to: "/knowledge", label: "Knowledge", icon: BookIcon },
    { to: "/expenses", label: "Expenses", icon: ExpenseIcon },
    { to: "/tasks", label: "Tasks", icon: TaskIcon, badge: overdueCount },
    { to: "/settings", label: "Settings", icon: SettingsIcon },
  ];
}

function OfflineBanner() {
  return (
    <div className="flex items-center justify-center gap-2 bg-brown-100 px-3 py-1.5 text-sm text-brown-800">
      <span className="inline-block h-2 w-2 rounded-full bg-terracotta-500" />
      You're offline — changes are saved locally
    </div>
  );
}

function TabBarLink({ item }: { item: NavItem }) {
  if (item.disabled) {
    return (
      <span className="flex min-w-[3rem] flex-col items-center gap-0.5 px-2 py-1 text-cream-300">
        <item.icon className="h-6 w-6" />
        <span className="text-[10px] leading-tight">{item.label}</span>
        <span className="text-[8px] leading-tight">Soon</span>
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `relative flex min-w-[3rem] flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
          isActive ? "text-green-400" : "text-cream-200 hover:text-cream-50"
        }`
      }
    >
      <item.icon className="h-6 w-6" />
      <span className="text-[10px] leading-tight">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="absolute -right-0.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[10px] font-bold text-white">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  if (item.disabled) {
    return (
      <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-cream-300">
        <item.icon className="h-5 w-5" />
        <span className="text-sm">{item.label}</span>
        <span className="ml-auto rounded-full bg-cream-300/20 px-2 py-0.5 text-[10px]">
          Soon
        </span>
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
          isActive
            ? "bg-green-700 text-white font-medium"
            : "text-cream-200 hover:bg-green-700/50 hover:text-cream-50"
        }`
      }
    >
      <item.icon className="h-5 w-5" />
      <span>{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta-500 px-1.5 text-[10px] font-bold text-white">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

function SyncStatusDot() {
  const { status, isConfigured } = useSync();
  const navigate = useNavigate();

  if (!isConfigured && status === "disabled") return null;

  const colorMap: Record<string, string> = {
    syncing: "bg-blue-500 animate-pulse",
    paused: "bg-green-500",
    error: "bg-red-500",
    offline: "bg-amber-500",
    disabled: "bg-soil-400",
  };

  const labelMap: Record<string, string> = {
    syncing: "Syncing",
    paused: "Synced",
    error: "Sync error",
    offline: "Offline",
    disabled: "Sync off",
  };

  return (
    <button
      type="button"
      onClick={() => navigate("/settings")}
      className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-green-700/50"
      title={labelMap[status] ?? "Sync"}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${colorMap[status] ?? "bg-soil-400"}`} />
      <span className="text-xs">{labelMap[status] ?? "Sync"}</span>
    </button>
  );
}

export default function AppShell() {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const overdueTasks = usePouchQuery(() => taskRepository.getOverdue());
  const overdueCount = overdueTasks?.length ?? 0;

  // Calendar badge: count plants with active planting windows this week
  const activeSeason = usePouchQuery(() => seasonRepository.getActive());
  const seasonPlantings = usePouchQuery(
    () => (activeSeason ? plantingRepository.getBySeason(activeSeason.id) : Promise.resolve([])),
    [activeSeason],
  );
  const allPlants = usePouchQuery(() => plantRepository.getAll());

  const calendarBadge = useMemo(() => {
    if (!seasonPlantings || !allPlants) return 0;
    const plantMap = new Map(allPlants.map((p) => [p.id, p]));
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    let count = 0;

    for (const planting of seasonPlantings) {
      const plant = plantMap.get(planting.plantInstanceId);
      if (!plant) continue;
      const knowledge = getBySpecies(plant.species);
      if (!knowledge) continue;
      const windows = computePlantingWindows(knowledge, settings);
      const hasActiveWindow =
        (windows.indoorStart && isWithinInterval(now, windows.indoorStart)) ||
        (windows.directSow && isWithinInterval(now, windows.directSow)) ||
        (windows.transplant && isWithinInterval(now, windows.transplant)) ||
        // Also check if window starts this week
        (windows.indoorStart && isWithinInterval(windows.indoorStart.start, { start: weekStart, end: weekEnd })) ||
        (windows.directSow && isWithinInterval(windows.directSow.start, { start: weekStart, end: weekEnd })) ||
        (windows.transplant && isWithinInterval(windows.transplant.start, { start: weekStart, end: weekEnd }));
      if (hasActiveWindow) count++;
    }
    return count;
  }, [seasonPlantings, allPlants, settings]);

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      {/* Skip to main content — visible only on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:rounded focus:bg-green-700 focus:px-4 focus:py-2 focus:text-cream-50"
      >
        Skip to main content
      </a>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:bg-green-800">
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-5">
          <span className="font-display text-xl font-bold text-cream-50">
            Jninty
          </span>
          <span className="text-cream-200">
            <SyncStatusDot />
          </span>
        </div>

        {/* Primary nav */}
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {getPrimaryNav(calendarBadge).map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}

          {/* Quick Log — sidebar variant */}
          <button
            onClick={() => navigate("/quick-log")}
            className="mt-2 flex items-center gap-3 rounded-lg bg-terracotta-500 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-terracotta-600"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Quick Log</span>
          </button>

          {/* Divider */}
          <div className="my-3 border-t border-green-700" />

          {/* Secondary nav */}
          {getSecondaryNav(overdueCount).map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        {/* Offline indicator at bottom of sidebar */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-cream-300">
            <span className="inline-block h-2 w-2 rounded-full bg-terracotta-500" />
            Offline
          </div>
        )}
      </aside>

      {/* ── Main content area ── */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-cream-200 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-green-800">
              Jninty
            </span>
            <span className="text-soil-600">
              <SyncStatusDot />
            </span>
          </div>
          {/* Secondary nav links for mobile — accessible via header */}
          <div className="flex items-center gap-3">
            <NavLink
              to="/journal"
              aria-label="Journal"
              className={({ isActive }) =>
                `p-1 ${isActive ? "text-green-800" : "text-soil-600 hover:text-green-700"}`
              }
            >
              <JournalIcon className="h-5 w-5" />
            </NavLink>
            <NavLink
              to="/seeds"
              aria-label="Seed Bank"
              className={({ isActive }) =>
                `p-1 ${isActive ? "text-green-800" : "text-soil-600 hover:text-green-700"}`
              }
            >
              <SeedNavIcon className="h-5 w-5" />
            </NavLink>
            <NavLink
              to="/knowledge"
              aria-label="Knowledge"
              className={({ isActive }) =>
                `p-1 ${isActive ? "text-green-800" : "text-soil-600 hover:text-green-700"}`
              }
            >
              <BookIcon className="h-5 w-5" />
            </NavLink>
            <NavLink
              to="/expenses"
              aria-label="Expenses"
              className={({ isActive }) =>
                `p-1 ${isActive ? "text-green-800" : "text-soil-600 hover:text-green-700"}`
              }
            >
              <ExpenseIcon className="h-5 w-5" />
            </NavLink>
            <NavLink
              to="/tasks"
              aria-label="Tasks"
              className={({ isActive }) =>
                `relative p-1 ${isActive ? "text-green-800" : "text-soil-600 hover:text-green-700"}`
              }
            >
              <TaskIcon className="h-5 w-5" />
              {overdueCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[10px] font-bold text-white">
                  {overdueCount}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/settings"
              aria-label="Settings"
              className={({ isActive }) =>
                `p-1 ${isActive ? "text-green-800" : "text-soil-600 hover:text-green-700"}`
              }
            >
              <SettingsIcon className="h-5 w-5" />
            </NavLink>
          </div>
        </header>

        {/* Offline banner — mobile */}
        {!isOnline && (
          <div className="md:hidden">
            <OfflineBanner />
          </div>
        )}

        {/* Offline banner — desktop */}
        {!isOnline && (
          <div className="hidden md:block">
            <OfflineBanner />
          </div>
        )}

        {/* Page content */}
        <main id="main-content" className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-end justify-around border-t border-green-900 bg-green-800 pb-[env(safe-area-inset-bottom)] md:hidden">
        {/* Home & Plants */}
        <TabBarLink item={getPrimaryNav(calendarBadge)[0]!} />
        <TabBarLink item={getPrimaryNav(calendarBadge)[1]!} />

        {/* Quick Log — center prominent button */}
        <button
          onClick={() => navigate("/quick-log")}
          aria-label="Quick Log"
          className="-mt-4 flex flex-col items-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-terracotta-500 shadow-lg transition-transform active:scale-95">
            <PlusIcon className="h-7 w-7 text-white" />
          </span>
          <span className="mt-0.5 text-[10px] leading-tight text-cream-200">
            Log
          </span>
        </button>

        {/* Calendar & Map */}
        <TabBarLink item={getPrimaryNav(calendarBadge)[2]!} />
        <TabBarLink item={getPrimaryNav(calendarBadge)[3]!} />
      </nav>
    </div>
  );
}
