/**
 * i18n configuration using i18next + react-i18next.
 * Default language is French (fr). English (en) available as fallback.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "../locales/fr.json";
import en from "../locales/en.json";

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: localStorage.getItem("geneao_lang") || "fr",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export default i18n;
