/**
 * Read-only modal showing a person's full details.
 * Displayed when clicking a PersonCard in view mode.
 */
import { useTranslation } from "react-i18next";
import type { Individual } from "../lib/gedcom-parser";
import { formatLifespan } from "../lib/gedcom-parser";
import { getDefaultAvatar } from "../lib/avatars";

interface Props {
  individual: Individual;
  onClose: () => void;
}

/** Format a detail row label + value, returning null when value is empty. */
function detailRow(label: string, value: string): React.ReactNode | null {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-stone-800">{value}</span>
    </div>
  );
}

export default function PersonDetailModal({ individual, onClose }: Props) {
  const { t } = useTranslation();

  const fullName = [individual.givenName, individual.surname].filter(Boolean).join(" ") || "?";
  const lifespan = formatLifespan(individual);
  const imgSrc = individual.photoUrl || getDefaultAvatar(individual.sex, individual.birthDate, individual.deathDate);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-label={t("personDetail.title")}
    >
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: photo + name */}
        <div className="flex flex-col items-center mb-4">
          <img
            src={imgSrc}
            alt={fullName}
            className="w-20 h-20 rounded-full object-cover border-2 border-stone-200 mb-3"
          />
          <h2 className="text-lg font-bold text-stone-800 text-center">{fullName}</h2>
          {lifespan && (
            <span className="text-sm text-stone-500">{lifespan}</span>
          )}
        </div>

        {/* Detail rows */}
        <div className="space-y-3">
          {detailRow(t("personDetail.birthDate"), individual.birthDate)}
          {detailRow(t("personDetail.birthPlace"), individual.birthPlace)}
          {detailRow(t("personDetail.deathDate"), individual.deathDate)}
          {detailRow(t("personDetail.deathPlace"), individual.deathPlace)}
          {detailRow(t("personDetail.livingPlace"), individual.livingPlace)}
          {detailRow(t("personDetail.note"), individual.note)}
        </div>

        {/* Close button */}
        <div className="flex justify-center mt-6">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-stone-600 hover:text-stone-800 border border-stone-300 rounded-lg hover:bg-stone-50 cursor-pointer"
          >
            {t("personDetail.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
