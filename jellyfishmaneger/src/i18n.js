// src/i18n.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// استدعاء ملفات الترجمة
import en from "./locales/en.json";
import ar from "./locales/ar.json";

const resources = {
  ar: { translation: ar },
  en: { translation: en },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "ar", // اللغة الافتراضية
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
