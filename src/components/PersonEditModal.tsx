/**
 * Modal for editing a person's details (name, dates, photo).
 */
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Individual } from "../lib/gedcom-parser";
import { updateIndividual, uploadPhoto, type CreateIndividualPayload } from "../lib/api";

interface Props {
  individual: Individual;
  onClose: () => void;
  onSaved: () => void;
}

export default function PersonEditModal({ individual, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [givenName, setGivenName] = useState(individual.givenName);
  const [surname, setSurname] = useState(individual.surname);
  const [birthDate, setBirthDate] = useState(individual.birthDate);
  const [birthPlace, setBirthPlace] = useState(individual.birthPlace);
  const [deathDate, setDeathDate] = useState(individual.deathDate);
  const [deathPlace, setDeathPlace] = useState(individual.deathPlace);
  const [livingPlace, setLivingPlace] = useState(individual.livingPlace);
  const [note, setNote] = useState(individual.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload: CreateIndividualPayload = {
        given_name: givenName,
        surname: surname,
        sex: individual.sex,
        birth_date: birthDate,
        death_date: deathDate,
        birth_place: birthPlace,
        death_place: deathPlace,
        living_place: livingPlace,
        note: note,
      };
      await updateIndividual(individual.id, payload);

      const file = fileRef.current?.files?.[0];
      if (file) {
        await uploadPhoto(individual.id, file);
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("editPerson.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-stone-800 mb-4">{t("editPerson.title")}</h2>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded mb-3">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">{t("editPerson.firstName")}</label>
            <input
              type="text"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">{t("editPerson.lastName")}</label>
            <input
              type="text"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">{t("editPerson.birthDate")}</label>
              <input
                type="text"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder={t("editPerson.birthDatePlaceholder")}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">{t("editPerson.birthPlace")}</label>
              <input
                type="text"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">{t("editPerson.deathDate")}</label>
              <input
                type="text"
                value={deathDate}
                onChange={(e) => setDeathDate(e.target.value)}
                placeholder={t("editPerson.deathDatePlaceholder")}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">{t("editPerson.deathPlace")}</label>
              <input
                type="text"
                value={deathPlace}
                onChange={(e) => setDeathPlace(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">{t("editPerson.livingPlace")}</label>
            <input
              type="text"
              value={livingPlace}
              onChange={(e) => setLivingPlace(e.target.value)}
              placeholder={t("editPerson.livingPlacePlaceholder")}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">{t("editPerson.note")}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">{t("editPerson.photo")}</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 cursor-pointer"
          >
            {t("editPerson.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !givenName || !surname}
            className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 cursor-pointer"
          >
            {saving ? t("editPerson.saving") : t("editPerson.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
