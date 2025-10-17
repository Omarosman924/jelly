"use client"
import { useEffect, useState } from "react";
import { FaMoon, FaSun } from "react-icons/fa";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // جلب الثيم المحفوظ من localStorage
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    // لو مفيش ثيم متخزن، هنستخدم ثيم الجهاز
    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;

    setIsDark(shouldUseDark);
    updateTheme(shouldUseDark);
  }, []);

  const updateTheme = (dark) => {
    if (dark) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark-theme");
    } else {
      document.documentElement.removeAttribute("data-theme");
      document.body.classList.remove("dark-theme");
    }
  };

  const toggleTheme = () => {
    const newTheme = !isDark;

    // إضافة transition effect
    document.documentElement.style.transition = "all 0.3s ease-in-out";

    setIsDark(newTheme);
    updateTheme(newTheme);

    // حفظ الثيم في localStorage
    localStorage.setItem("theme", newTheme ? "dark" : "light");

    // إزالة transition بعد انتهاءه
    setTimeout(() => {
      document.documentElement.style.transition = "";
    }, 300);
  };

  return (
    <div
      className="d-inline-block m-3"
      style={{ cursor: "pointer" }}
      onClick={toggleTheme}
      title={isDark ? "تبديل للوضع النهاري" : "تبديل للوضع الليلي"}
    >
      <div
        className="d-flex align-items-center justify-content-center shadow-sm"
        style={{
          width: "50px",
          height: "50px",
          background: isDark
            ? "linear-gradient(135deg, var(--accent-100), var(--accent-200))"
            : "linear-gradient(135deg, var(--primary-100), var(--primary-200))",
          color: isDark ? "var(--text-100)" : "var(--bg-100)",
          borderRadius: "50%",
          transition: "all 0.3s ease-in-out",
          border: "2px solid transparent",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background Animation Effect */}
        <div
          style={{
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            background: isDark
              ? "radial-gradient(circle, rgba(244,208,63,0.1) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(44,95,93,0.1) 0%, transparent 70%)",
            opacity: "0",
            transition: "opacity 0.3s ease",
            pointerEvents: "none",
          }}
          className="theme-bg-effect"
        />

        {/* Icon Container */}
        <div
          style={{
            position: "relative",
            zIndex: "2",
            transition: "all 0.3s ease-in-out",
            transform: isDark ? "rotate(0deg)" : "rotate(360deg)",
          }}
        >
          {isDark ? (
            <FaMoon
              style={{
                fontSize: "1.4rem",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                animation: "fadeIn 0.3s ease-in-out",
              }}
            />
          ) : (
            <FaSun
              style={{
                fontSize: "1.4rem",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                animation: "fadeIn 0.3s ease-in-out",
              }}
            />
          )}
        </div>
      </div>

      {/* Inline CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .theme-toggle:hover .theme-bg-effect {
          opacity: 1 !important;
        }

        .theme-toggle:active .ripple-effect {
          width: 60px !important;
          height: 60px !important;
          opacity: 0 !important;
        }
      `}</style>
    </div>
  );
}
