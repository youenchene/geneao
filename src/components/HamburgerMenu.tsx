import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { downloadLatestGedcom } from "../lib/api";

interface HamburgerMenuProps {
  onImportGedcom: () => void;
  onLogout: () => void;
}

export default function HamburgerMenu({ onImportGedcom, onLogout }: HamburgerMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadLatestGedcom();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
      setOpen(false);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded hover:bg-stone-100 cursor-pointer"
        aria-label={t("menu.label")}
        aria-expanded={open}
      >
        {/* Hamburger icon */}
        <svg className="w-5 h-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-white border border-stone-200 rounded-md shadow-lg py-1 z-50">
          <button
            onClick={() => {
              setOpen(false);
              onImportGedcom();
            }}
            className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            {t("menu.importGedcom")}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 cursor-pointer disabled:opacity-50"
          >
            {downloading ? t("menu.exportingGedcom") : t("menu.exportGedcom")}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            {t("app.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
