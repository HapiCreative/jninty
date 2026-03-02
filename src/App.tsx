import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { SettingsProvider } from "./hooks/useSettings";
import { ToastProvider } from "./components/ui/Toast";
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
import PlantingCalendarPage from "./pages/PlantingCalendarPage";
import SeasonComparisonPage from "./pages/SeasonComparisonPage";
import ExpensesPage from "./pages/ExpensesPage";
import ExpenseFormPage from "./pages/ExpenseFormPage";
import NotFoundPage from "./pages/NotFoundPage";
import MigrationScreen from "./components/MigrationScreen.tsx";
import { loadBuiltInRules } from "./services/taskRuleLoader.ts";
import { rebuildIndex, startListening } from "./db/search.ts";
import {
  isMigrationComplete,
  dexieHasData,
} from "./db/migration/dexieToPouchdb.ts";

// Lazy-load the map page to code-split the Konva.js bundle
const GardenMapPage = lazy(() => import("./pages/GardenMapPage"));

export default function App() {
  const [migrationNeeded, setMigrationNeeded] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkMigration() {
      const alreadyDone = await isMigrationComplete();
      if (alreadyDone) {
        setMigrationNeeded(false);
        return;
      }
      const hasData = await dexieHasData();
      setMigrationNeeded(hasData);
    }
    checkMigration().catch(() => setMigrationNeeded(false));
  }, []);

  const handleMigrationComplete = useCallback(() => {
    setMigrationNeeded(false);
  }, []);

  useEffect(() => {
    loadBuiltInRules().catch(console.error);
  }, []);

  // Initialize PouchDB search index and start listening for changes
  useEffect(() => {
    if (migrationNeeded !== false) return;
    rebuildIndex()
      .then(() => startListening())
      .catch(console.error);
  }, [migrationNeeded]);

  // Still checking migration status
  if (migrationNeeded === null) {
    return null;
  }

  // Show migration screen
  if (migrationNeeded) {
    return <MigrationScreen onComplete={handleMigrationComplete} />;
  }

  return (
    <SettingsProvider>
      <ToastProvider>
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
              <Route path="seeds" element={<SeedBankPage />} />
              <Route path="seeds/new" element={<SeedFormPage />} />
              <Route path="seeds/:id" element={<SeedDetailPage />} />
              <Route path="seeds/:id/edit" element={<SeedFormPage />} />
              <Route path="calendar" element={<PlantingCalendarPage />} />
              <Route path="seasons/compare" element={<SeasonComparisonPage />} />
              <Route
                path="map"
                element={
                  <Suspense
                    fallback={
                      <div className="flex h-64 items-center justify-center text-soil-400">
                        Loading map...
                      </div>
                    }
                  >
                    <GardenMapPage />
                  </Suspense>
                }
              />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="expenses/new" element={<ExpenseFormPage />} />
              <Route path="expenses/:id/edit" element={<ExpenseFormPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="quick-log" element={<QuickLogPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </SettingsProvider>
  );
}
