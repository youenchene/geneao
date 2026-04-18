/**
 * Two-step confirmation modal for deleting a person.
 * Step 1: "Are you sure?" with person name.
 * Step 2: "This is irreversible" final confirmation.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Individual } from "../lib/gedcom-parser";
import { deleteIndividual } from "../lib/api";

interface Props {
  individual: Individual;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeletePersonModal({ individual, onClose, onDeleted }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const fullName = [individual.givenName, individual.surname].filter(Boolean).join(" ") || "?";

  async function handleConfirm() {
    if (step === 1) {
      setStep(2);
      return;
    }

    // Step 2: actually delete
    if (!individual.apiId) return;
    setDeleting(true);
    setError("");
    try {
      await deleteIndividual(individual.apiId);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("deletePerson.failed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-label={t("deletePerson.title")}
    >
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
        </div>

        <h2 className="text-lg font-bold text-stone-800 text-center mb-2">
          {step === 1 ? t("deletePerson.confirm1Title") : t("deletePerson.confirm2Title")}
        </h2>

        <p className="text-sm text-stone-600 text-center mb-1">
          {step === 1
            ? t("deletePerson.confirm1Body", { name: fullName })
            : t("deletePerson.confirm2Body", { name: fullName })}
        </p>

        {step === 2 && (
          <p className="text-xs text-red-500 text-center mb-4 font-medium">
            {t("deletePerson.irreversible")}
          </p>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded mb-3 text-center">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 border border-stone-300 rounded-lg hover:bg-stone-50 cursor-pointer"
          >
            {t("deletePerson.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
          >
            {deleting ? t("deletePerson.deleting") : t("deletePerson.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
