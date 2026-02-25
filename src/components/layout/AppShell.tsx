import { NavLink, Outlet, useNavigate } from "react-router-dom";
import useOnlineStatus from "../../hooks/useOnlineStatus";

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
}

const primaryNav: NavItem[] = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/plants", label: "Plants", icon: PlantIcon },
  // Quick Log is rendered separately (center prominent button)
  { to: "/calendar", label: "Calendar", icon: CalendarIcon, disabled: true },
  { to: "/map", label: "Map", icon: MapIcon, disabled: true },
];

const secondaryNav: NavItem[] = [
  { to: "/journal", label: "Journal", icon: JournalIcon },
  { to: "/tasks", label: "Tasks", icon: TaskIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

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
        `flex min-w-[3rem] flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
          isActive ? "text-green-400" : "text-cream-200 hover:text-cream-50"
        }`
      }
    >
      <item.icon className="h-6 w-6" />
      <span className="text-[10px] leading-tight">{item.label}</span>
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
    </NavLink>
  );
}

export default function AppShell() {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:bg-green-800">
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-5">
          <span className="font-display text-xl font-bold text-cream-50">
            Jninty
          </span>
        </div>

        {/* Primary nav */}
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {primaryNav.map((item) => (
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
          {secondaryNav.map((item) => (
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
          <span className="font-display text-lg font-bold text-green-800">
            Jninty
          </span>
          {/* Secondary nav links for mobile — accessible via header */}
          <div className="flex items-center gap-3">
            <NavLink
              to="/journal"
              className={({ isActive }) =>
                `p-1 ${isActive ? "text-green-800" : "text-soil-600 hover:text-green-700"}`
              }
            >
              <JournalIcon className="h-5 w-5" />
            </NavLink>
            <NavLink
              to="/tasks"
              className={({ isActive }) =>
                `p-1 ${isActive ? "text-green-800" : "text-soil-600 hover:text-green-700"}`
              }
            >
              <TaskIcon className="h-5 w-5" />
            </NavLink>
            <NavLink
              to="/settings"
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
        <main className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-end justify-around border-t border-green-900 bg-green-800 pb-[env(safe-area-inset-bottom)] md:hidden">
        {/* Home & Plants */}
        <TabBarLink item={primaryNav[0]!} />
        <TabBarLink item={primaryNav[1]!} />

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
        <TabBarLink item={primaryNav[2]!} />
        <TabBarLink item={primaryNav[3]!} />
      </nav>
    </div>
  );
}
