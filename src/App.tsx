/** Application shell sharing authenticated genealogy data across tree and directory views. */
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { GedcomData } from "./lib/gedcom-parser";
import { buildFromApiData } from "./lib/gedcom-parser";
import { isAuthenticated, logout, getTree, getConfig } from "./lib/api";
import { EditModeProvider } from "./context/EditModeContext";
import EditModeToggle from "./components/EditModeToggle";
import LanguageSwitcher from "./components/LanguageSwitcher";
import Logo from "./components/Logo";
import HamburgerMenu from "./components/HamburgerMenu";
import ImportGedcomModal from "./components/ImportGedcomModal";
import CustomViewerPage from "./pages/CustomViewerPage";
import OnboardingOverlay from "./components/OnboardingOverlay";
import LoginPage from "./pages/LoginPage";
import DirectoryPage from "./pages/DirectoryPage";

export default function App() {
  const { t } = useTranslation();
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [data, setData] = useState<GedcomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [view, setView] = useState<"tree" | "directory">("tree");
  const [appTitle, setAppTitle] = useState<string | null>(null);

  // Fetch optional title override from backend config (GENEAO_TITLE).
  useEffect(() => {
    getConfig()
      .then((cfg) => {
        if (cfg.title) {
          setAppTitle(cfg.title);
          document.title = cfg.title;
        }
      })
      .catch(() => {
        // Config endpoint unavailable — keep defaults.
      });
  }, []);

  const fetchAndSetData = useCallback(() => {
    return getTree()
      .then((tree) => {
        // Build tree data directly from API — every entity already carries its UUID
        const data = buildFromApiData(tree);
        setData(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    fetchAndSetData();
  }, [fetchAndSetData]);

  // Refresh data without showing the loading screen, so that
  // CustomViewerPage stays mounted and the zoom/pan state is preserved.
  const refreshData = useCallback(() => {
    fetchAndSetData();
  }, [fetchAndSetData]);

  // Set loading when authentication state transitions to true (adjust state during render)
  const [prevAuthenticated, setPrevAuthenticated] = useState(authenticated);
  if (authenticated && authenticated !== prevAuthenticated) {
    setPrevAuthenticated(authenticated);
    setLoading(true);
  } else if (authenticated !== prevAuthenticated) {
    setPrevAuthenticated(authenticated);
  }

  useEffect(() => {
    if (authenticated) {
      fetchAndSetData();
    }
  }, [authenticated, fetchAndSetData]);

  if (!authenticated) {
    return <LoginPage onLogin={() => setAuthenticated(true)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-50 text-stone-500">
        {t("app.loading")}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-50 text-red-600">
        {t("app.error", { message: error || t("app.noData") })}
      </div>
    );
  }

  return (
    <EditModeProvider>
      <div className="flex flex-col h-screen">
        <nav className="flex items-center justify-between px-4 py-2 bg-white border-b border-stone-200 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-semibold text-stone-800">{appTitle || t("app.name")}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <EditModeToggle />
            <HamburgerMenu
              onImportGedcom={() => setShowImport(true)}
              onLogout={() => {
                logout();
                setAuthenticated(false);
              }}
            />
          </div>
        </nav>
        <div className="flex gap-1 border-b border-stone-200 bg-white px-4 py-2" role="group" aria-label={t("directory.viewLabel")}>
          {(["tree", "directory"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setView(item)}
              aria-pressed={view === item}
              className={`rounded-lg px-4 py-2 text-sm font-medium cursor-pointer ${view === item ? "bg-amber-100 text-amber-900" : "text-stone-600 hover:bg-stone-100"}`}
            >
              {t(`directory.${item}`)}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className={view === "tree" ? "h-full" : "hidden"}>
            <CustomViewerPage data={data} onDataChanged={refreshData} />
          </div>
          {view === "directory" && <DirectoryPage data={data} onDataChanged={refreshData} />}
        </div>
        {view === "tree" && <OnboardingOverlay />}
        {showImport && (
          <ImportGedcomModal
            onClose={() => setShowImport(false)}
            onImported={() => {
              setShowImport(false);
              loadData();
            }}
          />
        )}
      </div>
    </EditModeProvider>
  );
}
