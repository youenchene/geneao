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

/**
 * Format a clickable detail row (mailto/tel link), returning null when value is empty.
 */
function linkRow(label: string, value: string, href: string): React.ReactNode | null {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">{label}</span>
      <a
        href={href}
        className="text-sm text-amber-700 hover:text-amber-800 underline break-all"
      >
        {value}
      </a>
    </div>
  );
}

/** Join city + country as "City, Country", or whichever is present. */
function joinResidence(city: string, country: string): string {
  if (city && country) return `${city}, ${country}`;
  return city || country;
}

/**
 * Build a display name that includes prefix, nickname (quoted), and suffix when present.
 * Falls back to "GivenName Surname" or "?" if everything is empty.
 */
function buildFullName(individual: Individual): string {
  const parts: string[] = [];
  if (individual.namePrefix) parts.push(individual.namePrefix);
  if (individual.givenName) parts.push(individual.givenName);
  if (individual.nickname) parts.push(`"${individual.nickname}"`);
  if (individual.surname) parts.push(individual.surname);
  if (individual.nameSuffix) parts.push(individual.nameSuffix);
  return parts.length > 0 ? parts.join(" ") : "?";
}

export default function PersonDetailModal({ individual, onClose }: Props) {
  const { t } = useTranslation();

  const fullName = buildFullName(individual);
  const lifespan = formatLifespan(individual);
  const imgSrc = individual.photoUrl || getDefaultAvatar(individual.sex, individual.birthDate, individual.deathDate);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-label={t("personDetail.title")}
    >
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: photo + name */}
        <div className="flex flex-col items-center mb-4">
          <img
            src={imgSrc}
            alt={fullName}
            className="w-60 h-60 rounded-full object-cover border-2 border-stone-200 mb-3"
          />
          <h2 className="text-lg font-bold text-stone-800 text-center">{fullName}</h2>
          {lifespan && (
            <span className="text-sm text-stone-500">{lifespan}</span>
          )}
        </div>

        {/* Detail rows */}
        <div className="space-y-3">
          {detailRow(t("personDetail.occupation"), individual.occupation)}
          {detailRow(t("personDetail.birthDate"), individual.birthDate)}
          {detailRow(t("personDetail.birthPlace"), individual.birthPlace)}
          {detailRow(t("personDetail.deathDate"), individual.deathDate)}
          {detailRow(t("personDetail.deathPlace"), individual.deathPlace)}
          {detailRow(t("personDetail.burialDate"), individual.burialDate)}
          {detailRow(t("personDetail.burialPlace"), individual.burialPlace)}
          {detailRow(
            t("personDetail.livingPlace"),
            joinResidence(individual.livingCity, individual.livingCountry)
          )}
          {linkRow(t("personDetail.email"), individual.email, `mailto:${individual.email}`)}
          {linkRow(t("personDetail.phone"), individual.phone, `tel:${individual.phone}`)}
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
