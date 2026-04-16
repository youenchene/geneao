/**
 * Overlay panel showing descendant counts per generation from the focal couple.
 * Displays genealogical labels: Children, Grandchildren, Great-grandchildren, etc.
 * Positioned top-left of the tree viewer, outside the zoom/pan area.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GedcomData } from "../lib/gedcom-parser";
import { countDescendantsByGeneration } from "../lib/tree-layout";

interface Props {
  data: GedcomData;
  focalFamilyId: string | null;
}

/**
 * Returns the i18n key for a generation index.
 * 0 → children, 1 → grandchildren, 2 → greatGrandchildren,
 * 3+ → nthGreatGrandchildren with ordinal interpolation.
 */
function generationLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  index: number
): string {
  switch (index) {
    case 0:
      return t("stats.children");
    case 1:
      return t("stats.grandchildren");
    case 2:
      return t("stats.greatGrandchildren");
    default:
      return t("stats.nthGreatGrandchildren", { ordinal: index - 1 });
  }
}

export default function DescendantStats({ data, focalFamilyId }: Props) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  const generations = useMemo(() => {
    if (!focalFamilyId) return [];
    return countDescendantsByGeneration(data, focalFamilyId);
  }, [data, focalFamilyId]);

  if (generations.length === 0) return null;

  const total = generations.reduce((sum, count) => sum + count, 0);

  return (
    <div className="absolute top-3 left-3 z-20">
      <div className="bg-white/90 border border-stone-300 rounded-lg shadow-sm text-xs">
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="w-full flex items-center justify-between gap-2 px-3 py-1.5 font-semibold text-stone-700 hover:bg-stone-50 rounded-lg cursor-pointer select-none"
        >
          <span>{t("stats.title")}</span>
          <span className="text-stone-400">{collapsed ? "▸" : "▾"}</span>
        </button>
        {!collapsed && (
          <div className="px-3 pb-2 space-y-0.5">
            {generations.map((count, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 text-stone-600"
              >
                <span>{generationLabel(t, i)}</span>
                <span className="font-medium text-stone-800">{count}</span>
              </div>
            ))}
            <div className="border-t border-stone-200 mt-1 pt-1 flex items-center justify-between gap-4 font-semibold text-stone-700">
              <span>Total</span>
              <span>{total}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
