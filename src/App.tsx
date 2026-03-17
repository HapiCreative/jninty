import { lazy, Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { SettingsProvider, useSettings } from "./hooks/useSettings";
import { SyncProvider } from "./hooks/useSync";
import { ToastProvider } from "./components/ui/Toast";
import { useTheme } from "./hooks/useTheme";
import { useFontSize } from "./hooks/useFontSize";
import DashboardPage from "./pages/DashboardPage";
import PlantsListPage from "./pages/PlantsListPage";
import PlantDetailPage from "./pages/PlantDetailPage";
import PlantFormPage from "./pages/PlantFormPage";
import JournalPage from "./pages/JournalPage";
import JournalEntryFormPage from "./pages/JournalEntryFormPage";
import TasksPage from "./pages/TasksPage";
import SettingsPage from "./pages/SettingsPage";
import SeedBankPage from "./pages/SeedBankPage";
import SeedDetailPage from "./pages/SeedDetailPage";
import SeedFormPage from "./pages/SeedFormPage";
import QuickLogPage from "./pages/QuickLogPage";
import CalendarPage from "./pages/CalendarPage";
import SeasonComparisonPage from "./pages/SeasonComparisonPage";
import ExpensesPage from "./pages/ExpensesPage";
import ExpenseFormPage from "./pages/ExpenseFormPage";
import KnowledgeHubPage from "./pages/KnowledgeHubPage";
import KnowledgeDetailPage from "./pages/KnowledgeDetailPage";
import KnowledgeFormPage from "./pages/KnowledgeFormPage";
import NotFoundPage from "./pages/NotFoundPage";
import InstallPrompt from "./components/InstallPrompt";
import { loadBuiltInRules } from "./services/taskRuleLoader.ts";
import { rebuildIndex, startListening } from "./db/search.ts";
import { buildSchedulableSearchIndex } from "./services/knowledgeBase.ts";
import { checkAndNotifyTasks } from "./services/notifications.ts";
import {
  startNotificationListening,
  stopNotificationListening,
} from "./services/notificationListener.ts";
import { isCloudEnabled, apiUrl } from "./config/cloud";
import { useAuth } from "./store/authStore";
import { startCloudSync } from "./lib/cloudSync";
import { normalizeUser } from "./lib/apiClient";
import CloudGate from "./components/cloud/CloudGate";

// Lazy-load the map page to code-split the Konva.js bundle
const GardenMapPage = lazy(() => import("./pages/GardenMapPage"));
const KnowledgeCategoryPage = lazy(() => import("./pages/KnowledgeCategoryPage"));
const KnowledgeSpeciesPage = lazy(() => import("./pages/KnowledgeSpeciesPage"));

function ThemeApplicator() {
  const { settings } = useSettings();
  useTheme(settings.theme, settings.highContrast);
  useFontSize(settings.fontSize);
  return null;
}

export default function App() {
  useEffect(() => {
    loadBuiltInRules().catch(console.error);
  }, []);

  // Initialize PouchDB search index and start listening for changes
  useEffect(() => {
    rebuildIndex()
      .then(() => startListening())
      .catch(console.error);
  }, []);

  // Initialize schedulable plant search index
  useEffect(() => {
    buildSchedulableSearchIndex();
  }, []);

  // Check for due/overdue tasks on mount and window focus
  useEffect(() => {
    void checkAndNotifyTasks();
    const handleFocus = () => void checkAndNotifyTasks();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Listen to PouchDB changes for incoming tasks (via sync)
  useEffect(() => {
    startNotificationListening();
    return () => stopNotificationListening();
  }, []);

  // Stripe redirect handler — activates account after checkout
  const { state: authState, dispatch: authDispatch } = useAuth();
  const activatingRef = useRef(false);
  useEffect(() => {
    if (!isCloudEnabled || !apiUrl) return;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (sessionId && !authState.isAuthenticated && !activatingRef.current) {
      activatingRef.current = true;
      fetch(`${apiUrl}/auth/activate?session_id=${sessionId}`, {
        method: "POST",
        credentials: "include", // server sets auth cookie via Set-Cookie
      })
        .then((res) => res.json())
        .then((data: { user?: Record<string, unknown> }) => {
          if (data.user) {
            const user = normalizeUser(data.user);
            authDispatch({
              type: "LOGIN",
              payload: { user },
            });
            startCloudSync(user.id);
            window.history.replaceState({}, "", window.location.pathname);
          }
        })
        .catch(() => {
          // Payment verification failed — user can retry from settings
          activatingRef.current = false;
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start cloud sync when session is restored (e.g. page reload, new tab/device)
  const syncStartedRef = useRef(false);
  useEffect(() => {
    if (
      isCloudEnabled &&
      authState.isAuthenticated &&
      authState.user &&
      !syncStartedRef.current
    ) {
      syncStartedRef.current = true;
      startCloudSync(authState.user.id);
    }
    if (!authState.isAuthenticated) {
      syncStartedRef.current = false;
    }
  }, [authState.isAuthenticated, authState.user]);

  return (
    <SettingsProvider>
      <ThemeApplicator />
      <SyncProvider>
        <ToastProvider>
          <CloudGate>
          <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="plants" element={<PlantsListPage />} />
              <Route path="plants/new" element={<PlantFormPage />} />
              <Route path="plants/:id" element={<PlantDetailPage />} />
              <Route path="plants/:id/edit" element={<PlantFormPage />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="journal/new" element={<JournalEntryFormPage />} />
              <Route path="journal/:id/edit" element={<JournalEntryFormPage />} />
              <Route path="seeds" element={<SeedBankPage />} />
              <Route path="seeds/new" element={<SeedFormPage />} />
              <Route path="seeds/:id" element={<SeedDetailPage />} />
              <Route path="seeds/:id/edit" element={<SeedFormPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="seasons/compare" element={<SeasonComparisonPage />} />
              <Route
                path="map"
                element={
                  <Suspense
                    fallback={
                      <div className="flex h-64 items-center justify-center text-text-muted">
                        Loading map...
                      </div>
                    }
                  >
                    <GardenMapPage />
                  </Suspense>
                }
              />
              <Route path="knowledge" element={<KnowledgeHubPage />} />
              <Route path="knowledge/plants/:category" element={
                <Suspense fallback={<div className="flex h-64 items-center justify-center text-text-muted">Loading...</div>}>
                  <KnowledgeCategoryPage />
                </Suspense>
              } />
              <Route path="knowledge/species/:speciesSlug" element={
                <Suspense fallback={<div className="flex h-64 items-center justify-center text-text-muted">Loading...</div>}>
                  <KnowledgeSpeciesPage />
                </Suspense>
              } />
              <Route path="knowledge/new" element={<KnowledgeFormPage />} />
              <Route path="knowledge/:id" element={<KnowledgeDetailPage />} />
              <Route path="knowledge/:id/edit" element={<KnowledgeFormPage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="expenses/new" element={<ExpenseFormPage />} />
              <Route path="expenses/:id/edit" element={<ExpenseFormPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="quick-log" element={<QuickLogPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          <InstallPrompt />
          </BrowserRouter>
          </CloudGate>
        </ToastProvider>
      </SyncProvider>
    </SettingsProvider>
  );
}
