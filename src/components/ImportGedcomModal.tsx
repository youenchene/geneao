import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { importGedcom } from "../lib/api";

interface ImportGedcomModalProps {
  onClose: () => void;
  onImported: () => void;
}

export default function ImportGedcomModal({ onClose, onImported }: ImportGedcomModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      await importGedcom(file);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-stone-800 mb-4">{t("import.title")}</h2>

        <div className="mb-4">
          <label className="block text-sm text-stone-600 mb-2">{t("import.selectFile")}</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ged"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200 file:cursor-pointer"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4">{t("import.failed", { message: error })}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 cursor-pointer"
          >
            {t("import.cancel")}
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-4 py-2 text-sm text-white bg-stone-800 rounded hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {importing ? t("import.importing") : t("import.import")}
          </button>
        </div>
      </div>
    </div>
  );
}
