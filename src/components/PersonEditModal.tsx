/**
 * Modal for editing a person's details (name, sex, dates, places, photo, and
 * additional GEDCOM fields under a collapsible "more details" section).
 */
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Individual } from "../lib/gedcom-parser";
import { updateIndividual, uploadPhoto, deletePhoto, type CreateIndividualPayload } from "../lib/api";

interface Props {
  individual: Individual;
  onClose: () => void;
  onSaved: () => void;
}

export default function PersonEditModal({ individual, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [givenName, setGivenName] = useState(individual.givenName);
  const [surname, setSurname] = useState(individual.surname);
  const [sex, setSex] = useState<"M" | "F" | "U">(individual.sex);
  const [birthDate, setBirthDate] = useState(individual.birthDate);
  const [birthPlace, setBirthPlace] = useState(individual.birthPlace);
  const [deathDate, setDeathDate] = useState(individual.deathDate);
  const [deathPlace, setDeathPlace] = useState(individual.deathPlace);
  const [livingCity, setLivingCity] = useState(individual.livingCity);
  const [livingCountry, setLivingCountry] = useState(individual.livingCountry);
  const [email, setEmail] = useState(individual.email);
  const [phone, setPhone] = useState(individual.phone);
  const [note, setNote] = useState(individual.note);
  // Additional (Tier 1) fields — shown inside the collapsible section.
  const [namePrefix, setNamePrefix] = useState(individual.namePrefix);
  const [nameSuffix, setNameSuffix] = useState(individual.nameSuffix);
  const [nickname, setNickname] = useState(individual.nickname);
  const [occupation, setOccupation] = useState(individual.occupation);
  const [burialDate, setBurialDate] = useState(individual.burialDate);
  const [burialPlace, setBurialPlace] = useState(individual.burialPlace);
  // Auto-expand the extra section if the person already has any extra data.
  const hasExtraData = !!(
    individual.namePrefix ||
    individual.nameSuffix ||
    individual.nickname ||
    individual.occupation ||
    individual.burialDate ||
    individual.burialPlace
  );
  const [showMore, setShowMore] = useState(hasExtraData);
  const [saving, setSaving] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(!!individual.photoUrl);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleRemovePhoto() {
    if (!window.confirm(t("editPerson.removePhotoConfirm"))) return;
    setRemovingPhoto(true);
    setError("");
    try {
      await deletePhoto(individual.id);
      setHasPhoto(false);
      // Reset the file input so any previously selected file is cleared.
      if (fileRef.current) fileRef.current.value = "";
      // Refresh parent so the tree reflects the change immediately.
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("editPerson.removePhotoFailed"));
    } finally {
      setRemovingPhoto(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload: CreateIndividualPayload = {
        given_name: givenName,
        surname: surname,
        name_prefix: namePrefix,
        name_suffix: nameSuffix,
        nickname: nickname,
        sex: sex,
        birth_date: birthDate,
        death_date: deathDate,
        birth_place: birthPlace,
        death_place: deathPlace,
        burial_date: burialDate,
        burial_place: burialPlace,
        living_city: livingCity,
        living_country: livingCountry,
        occupation: occupation,
        email: email,
        phone: phone,
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

  const inputClass =
    "w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400";
  const labelClass = "block text-sm font-medium text-stone-600 mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
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
            <label className={labelClass}>{t("editPerson.firstName")}</label>
            <input
              type="text"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("editPerson.lastName")}</label>
            <input
              type="text"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("editPerson.sex")}</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as "M" | "F" | "U")}
              className={inputClass}
            >
              <option value="M">{t("editPerson.male")}</option>
              <option value="F">{t("editPerson.female")}</option>
              <option value="U">{t("editPerson.unknown")}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("editPerson.birthDate")}</label>
              <input
                type="text"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder={t("editPerson.birthDatePlaceholder")}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("editPerson.birthPlace")}</label>
              <input
                type="text"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("editPerson.deathDate")}</label>
              <input
                type="text"
                value={deathDate}
                onChange={(e) => setDeathDate(e.target.value)}
                placeholder={t("editPerson.deathDatePlaceholder")}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("editPerson.deathPlace")}</label>
              <input
                type="text"
                value={deathPlace}
                onChange={(e) => setDeathPlace(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("editPerson.livingCity")}</label>
              <input
                type="text"
                value={livingCity}
                onChange={(e) => setLivingCity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("editPerson.livingCountry")}</label>
              <input
                type="text"
                value={livingCountry}
                onChange={(e) => setLivingCountry(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("editPerson.email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("editPerson.phone")}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("editPerson.note")}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div>
            <label className={labelClass}>{t("editPerson.photo")}</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
            />
            {hasPhoto && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={removingPhoto}
                className="mt-2 text-sm text-red-600 hover:text-red-700 disabled:opacity-50 cursor-pointer"
              >
                {removingPhoto ? t("editPerson.removingPhoto") : t("editPerson.removePhoto")}
              </button>
            )}
          </div>

          {/* More details (collapsible) */}
          <div className="border-t border-stone-200 pt-3">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-medium text-stone-600 hover:text-stone-800 cursor-pointer"
              aria-expanded={showMore}
            >
              <span>{t("editPerson.moreDetails")}</span>
              <span className="text-stone-400">{showMore ? "▾" : "▸"}</span>
            </button>

            {showMore && (
              <div className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t("editPerson.namePrefix")}</label>
                    <input
                      type="text"
                      value={namePrefix}
                      onChange={(e) => setNamePrefix(e.target.value)}
                      placeholder={t("editPerson.namePrefixPlaceholder")}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("editPerson.nameSuffix")}</label>
                    <input
                      type="text"
                      value={nameSuffix}
                      onChange={(e) => setNameSuffix(e.target.value)}
                      placeholder={t("editPerson.nameSuffixPlaceholder")}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t("editPerson.nickname")}</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("editPerson.occupation")}</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t("editPerson.burialDate")}</label>
                    <input
                      type="text"
                      value={burialDate}
                      onChange={(e) => setBurialDate(e.target.value)}
                      placeholder={t("editPerson.deathDatePlaceholder")}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("editPerson.burialPlace")}</label>
                    <input
                      type="text"
                      value={burialPlace}
                      onChange={(e) => setBurialPlace(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            )}
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
