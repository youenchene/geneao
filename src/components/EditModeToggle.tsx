/**
 * Toggle button for switching between view and edit modes.
 */
import { useTranslation } from "react-i18next";
import { useEditMode } from "../context/EditModeContext";

export default function EditModeToggle() {
  const { t } = useTranslation();
  const { editMode, toggleEditMode } = useEditMode();

  return (
    <button
      onClick={toggleEditMode}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
        editMode
          ? "bg-amber-600 text-white hover:bg-amber-700"
          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
      }`}
      title={editMode ? t("editMode.switchToView") : t("editMode.switchToEdit")}
    >
      {editMode ? t("editMode.editing") : t("editMode.viewing")}
    </button>
  );
}
