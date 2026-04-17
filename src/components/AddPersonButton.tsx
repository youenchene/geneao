/**
 * SVG "+" buttons for adding new family members in edit mode.
 * - Right side of card: add alliance (spouse)
 * - Bottom of card: add child
 *
 * The form renders as a React portal modal in the DOM root (outside SVG)
 * to avoid foreignObject positioning/input issues with react-zoom-pan-pinch.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { createIndividual, createFamily, updateFamily, getFamily, type CreateIndividualPayload, type CreateFamilyPayload } from "../lib/api";

interface Props {
  type: "alliance" | "child" | "parent";
  x: number;
  y: number;
  linkedIndividualApiId: string;
  linkedIndividualSex?: "M" | "F" | "U";
  familyApiId?: string;
  existingChildApiIds?: string[];
  tooltipKey?: string;
  dataOnboarding?: string;
  onCreated: () => void;
}

export default function AddPersonButton({
  type,
  x,
  y,
  linkedIndividualApiId,
  linkedIndividualSex,
  familyApiId,
  existingChildApiIds,
  tooltipKey,
  dataOnboarding,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [givenName, setGivenName] = useState("");
  const [surname, setSurname] = useState("");
  const [sex, setSex] = useState<"M" | "F" | "U">("U");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!givenName || !surname) return;
    setSaving(true);
    setError("");
    try {
      const payload: CreateIndividualPayload = {
        given_name: givenName,
        surname: surname,
        sex,
      };
      const newPerson = await createIndividual(payload);

      if (type === "alliance") {
        // Determine roles: use the new person's sex and the existing person's sex
        // to decide who is husband and who is wife.
        let husbandId: string | null = null;
        let wifeId: string | null = null;

        if (sex === "M") {
          husbandId = newPerson.id;
          wifeId = linkedIndividualApiId || null;
        } else if (sex === "F") {
          husbandId = linkedIndividualApiId || null;
          wifeId = newPerson.id;
        } else {
          // sex is "U" — use the existing person's sex to decide
          if (linkedIndividualSex === "M") {
            husbandId = linkedIndividualApiId || null;
            wifeId = newPerson.id;
          } else if (linkedIndividualSex === "F") {
            wifeId = linkedIndividualApiId || null;
            husbandId = newPerson.id;
          } else {
            // Both unknown — default: existing = husband, new = wife
            husbandId = linkedIndividualApiId || null;
            wifeId = newPerson.id;
          }
        }

        await createFamily({
          husband_id: husbandId,
          wife_id: wifeId,
        });
      } else if (type === "parent") {
        if (familyApiId) {
          // Parent family already exists but is missing a parent — fill the empty slot
          const currentFamily = await getFamily(familyApiId);
          const updatedPayload: CreateFamilyPayload = {
            husband_id: currentFamily.husband_id,
            wife_id: currentFamily.wife_id,
            marriage_date: currentFamily.marriage_date,
            marriage_place: currentFamily.marriage_place,
            divorce_date: currentFamily.divorce_date,
            note: currentFamily.note,
            child_ids: currentFamily.child_ids || [],
          };
          // Fill the empty parent slot based on the new person's sex
          if (sex === "F" && !currentFamily.wife_id) {
            updatedPayload.wife_id = newPerson.id;
          } else if (sex === "M" && !currentFamily.husband_id) {
            updatedPayload.husband_id = newPerson.id;
          } else if (!currentFamily.husband_id) {
            updatedPayload.husband_id = newPerson.id;
          } else {
            updatedPayload.wife_id = newPerson.id;
          }
          await updateFamily(familyApiId, updatedPayload);
        } else {
          // No parent family exists — create one with the new person as parent
          // and the linked individual as child
          const famPayload: CreateFamilyPayload = {
            husband_id: sex === "M" ? newPerson.id : null,
            wife_id: sex === "F" ? newPerson.id : null,
            child_ids: [linkedIndividualApiId],
          };
          // If sex unknown, default new person to father
          if (sex !== "M" && sex !== "F") {
            famPayload.husband_id = newPerson.id;
          }
          await createFamily(famPayload);
        }
      } else if (type === "child") {
        if (familyApiId) {
          // Fetch the current family so we preserve existing fields
          const currentFamily = await getFamily(familyApiId);
          const updatedPayload: CreateFamilyPayload = {
            husband_id: currentFamily.husband_id,
            wife_id: currentFamily.wife_id,
            marriage_date: currentFamily.marriage_date,
            marriage_place: currentFamily.marriage_place,
            divorce_date: currentFamily.divorce_date,
            note: currentFamily.note,
            child_ids: [...(existingChildApiIds || []), newPerson.id],
          };
          await updateFamily(familyApiId, updatedPayload);
        } else {
          // No family exists yet — create one with the linked individual as parent
          // and the new person as child
          const famPayload: CreateFamilyPayload = {
            husband_id: linkedIndividualSex === "M" ? (linkedIndividualApiId || null) : null,
            wife_id: linkedIndividualSex === "F" ? (linkedIndividualApiId || null) : null,
            child_ids: [newPerson.id],
          };
          // If sex unknown, default linked individual to husband
          if (linkedIndividualSex !== "M" && linkedIndividualSex !== "F") {
            famPayload.husband_id = linkedIndividualApiId || null;
          }
          await createFamily(famPayload);
        }
      }

      setShowForm(false);
      setGivenName("");
      setSurname("");
      setSex("U");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("addPerson.failed"));
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setShowForm(false);
    setGivenName("");
    setSurname("");
    setSex("U");
    setError("");
  }

  const size = 18;

  return (
    <>
      {/* SVG "+" circle button rendered in the tree */}
      <g
        onClick={(e) => {
          e.stopPropagation();
          setShowForm(true);
        }}
        style={{ cursor: "pointer" }}
        {...(dataOnboarding ? { "data-onboarding": dataOnboarding } : {})}
      >
        <title>{tooltipKey ? t(tooltipKey) : type === "alliance" ? t("tooltip.addSpouse") : type === "parent" ? t("tooltip.addParent") : t("tooltip.addChild")}</title>
        <circle
          cx={x}
          cy={y}
          r={size / 2}
          fill="#fffbeb"
          stroke="#d97706"
          strokeWidth={1.5}
        />
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={14}
          fill="#b45309"
          fontWeight={700}
          fontFamily="system-ui, sans-serif"
        >
          +
        </text>
      </g>

      {/* Modal form rendered as a portal in the DOM root (outside SVG) */}
      {showForm &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={handleClose}
          >
            <div
              className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-stone-800 mb-4">
                {type === "alliance"
                  ? tooltipKey ? t("addPerson.addAnotherSpouse") : t("addPerson.addSpouse")
                  : type === "parent"
                    ? t("addPerson.addParent")
                    : t("addPerson.addChild")}
              </h2>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded mb-3">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-1">
                    {t("addPerson.firstName")}
                  </label>
                  <input
                    type="text"
                    value={givenName}
                    onChange={(e) => setGivenName(e.target.value)}
                    placeholder={t("addPerson.firstName")}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-1">
                    {t("addPerson.lastName")}
                  </label>
                  <input
                    type="text"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    placeholder={t("addPerson.lastName")}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-1">
                    {t("addPerson.sex")}
                  </label>
                  <div className="flex gap-2">
                    {(["M", "F", "U"] as const).map((value) => {
                      const labels = {
                        M: t("addPerson.male"),
                        F: t("addPerson.female"),
                        U: t("addPerson.unknown"),
                      };
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSex(value)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                            sex === value
                              ? "bg-amber-600 text-white"
                              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                          }`}
                        >
                          {labels[value]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 cursor-pointer"
                >
                  {t("addPerson.cancel")}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !givenName || !surname}
                  className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "…" : t("addPerson.add")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
