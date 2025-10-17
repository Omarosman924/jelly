import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { FaGlobe } from "react-icons/fa";
import { loadBootstrapCSS } from "../../utils/loadBootstrap";

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    // Get saved language preference or default to Arabic
    const savedLang = localStorage.getItem("preferredLanguage") || "ar";

    if (savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
    }

    // Set initial direction and language
    const isRTL = savedLang === "ar";
    document.documentElement.lang = savedLang;
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    loadBootstrapCSS(isRTL);
  }, [i18n]);

  const changeLanguage = async () => {
    if (isChanging) return; // Prevent multiple clicks during transition

    setIsChanging(true);
    const newLang = i18n.language === "ar" ? "en" : "ar";
    const isRTL = newLang === "ar";

    // Add transition class
    document.documentElement.classList.add("lang-transition");

    try {
      // Change language
      await i18n.changeLanguage(newLang);

      // Update HTML attributes
      document.documentElement.lang = newLang;
      document.documentElement.dir = isRTL ? "rtl" : "ltr";

      // Load appropriate Bootstrap CSS
      loadBootstrapCSS(isRTL);

      // Save preference
      localStorage.setItem("preferredLanguage", newLang);

      // Remove transition class after animation
      setTimeout(() => {
        document.documentElement.classList.remove("lang-transition");
        setIsChanging(false);
      }, 400);
    } catch (error) {
      console.error("Error changing language:", error);
      document.documentElement.classList.remove("lang-transition");
      setIsChanging(false);
    }
  };

  return (
    <div
      className="d-inline-block"
      style={{ cursor: isChanging ? "wait" : "pointer" }}
      onClick={changeLanguage}
      role="button"
      aria-label={`Switch to ${i18n.language === "ar" ? "English" : "Arabic"}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          changeLanguage();
        }
      }}
    >
      <div
        className="d-flex align-items-center justify-content-center shadow-sm"
        style={{
          minWidth: "70px",
          height: "45px",
          background:
            "linear-gradient(135deg, var(--primary-100), var(--primary-200))",
          color: "var(--bg-100)",
          fontSize: "1rem",
          fontWeight: "bold",
          borderRadius: "30px",
          gap: "8px",
          padding: "0 15px",
          transition: "all 0.3s ease-in-out",
          border: "2px solid transparent",
          backgroundClip: "padding-box",
          opacity: isChanging ? 0.7 : 1,
          pointerEvents: isChanging ? "none" : "auto",
        }}
        onMouseEnter={(e) => {
          if (isChanging) return;
          e.currentTarget.style.transform = "translateY(-2px) scale(1.05)";
          e.currentTarget.style.background =
            "linear-gradient(135deg, var(--accent-100), var(--accent-200))";
          e.currentTarget.style.color = "var(--text-100)";
          e.currentTarget.style.boxShadow =
            "0 8px 20px var(--shadow-accent-100)";
          e.currentTarget.style.borderColor = "var(--accent-100)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0) scale(1)";
          e.currentTarget.style.background =
            "linear-gradient(135deg, var(--primary-100), var(--primary-200))";
          e.currentTarget.style.color = "var(--bg-100)";
          e.currentTarget.style.boxShadow = "0 2px 8px var(--shadow-100)";
          e.currentTarget.style.borderColor = "transparent";
        }}
      >
        <FaGlobe
          style={{
            fontSize: "1.2rem",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
            animation: isChanging ? "spin 0.6s linear infinite" : "none",
          }}
        />
        <span
          style={{
            textShadow: "0 1px 2px rgba(0,0,0,0.1)",
            letterSpacing: "0.5px",
          }}
        >
          {i18n.language === "ar" ? "EN" : "ع"}
        </span>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .lang-transition * {
          transition: all 0.4s ease-in-out !important;
        }
      `}</style>
    </div>
  );
}
