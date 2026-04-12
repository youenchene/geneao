/**
 * Language switcher — toggles between French and English.
 */
import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  function switchLang() {
    const next = i18n.language === "fr" ? "en" : "fr";
    i18n.changeLanguage(next);
    localStorage.setItem("geneao_lang", next);
  }

  return (
    <button
      onClick={switchLang}
      className="px-2 py-1 text-xs text-stone-500 hover:text-stone-700 border border-stone-200 rounded cursor-pointer"
      title={i18n.language === "fr" ? "Switch to English" : "Passer en français"}
    >
      {i18n.language === "fr" ? "EN" : "FR"}
    </button>
  );
}
