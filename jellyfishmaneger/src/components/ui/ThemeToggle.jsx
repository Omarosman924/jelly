import { useEffect, useState } from "react";
import { FaMoon, FaSun } from "react-icons/fa";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Get saved theme or use system preference
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;

    setIsDark(shouldUseDark);
    updateTheme(shouldUseDark, false); // false = no animation on initial load

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      if (!localStorage.getItem("theme")) {
        // Only auto-switch if user hasn't set a preference
        setIsDark(e.matches);
        updateTheme(e.matches, true);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const updateTheme = (dark, animate = true) => {
    if (dark) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark-theme");
    } else {
      document.documentElement.removeAttribute("data-theme");
      document.body.classList.remove("dark-theme");
    }

    // Dispatch custom event for other components
    window.dispatchEvent(
      new CustomEvent("themeChange", {
        detail: { isDark: dark, animate },
      })
    );
  };

  const toggleTheme = () => {
    if (isTransitioning) return; // Prevent rapid clicks

    setIsTransitioning(true);
    const newTheme = !isDark;

    // Add transition class
    document.documentElement.classList.add("theme-transition");

    // Update theme
    setIsDark(newTheme);
    updateTheme(newTheme, true);
    localStorage.setItem("theme", newTheme ? "dark" : "light");

    // Cleanup after transition
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
      setIsTransitioning(false);
    }, 300);
  };

  return (
    <div
      className="d-inline-block"
      style={{ cursor: isTransitioning ? "wait" : "pointer" }}
      onClick={toggleTheme}
      role="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleTheme();
        }
      }}
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
          opacity: isTransitioning ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (isTransitioning) return;
          e.currentTarget.style.transform = "scale(1.1) rotate(5deg)";
          e.currentTarget.style.boxShadow = isDark
            ? "0 8px 20px rgba(212, 175, 55, 0.4)"
            : "0 8px 20px rgba(26, 95, 95, 0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1) rotate(0deg)";
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
        }}
      >
        {/* Background circle animation */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            background: isDark
              ? "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(0,0,0,0.05) 0%, transparent 70%)",
            animation: "pulse 2s ease-in-out infinite",
            opacity: 0.6,
          }}
        />

        {/* Icon container */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            transition: "all 0.3s ease-in-out",
            transform: isDark ? "rotate(0deg)" : "rotate(360deg)",
          }}
        >
          {isDark ? (
            <FaMoon
              style={{
                fontSize: "1.4rem",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                animation: "fadeInRotate 0.3s ease-in-out",
              }}
            />
          ) : (
            <FaSun
              style={{
                fontSize: "1.4rem",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                animation: "fadeInRotate 0.3s ease-in-out",
              }}
            />
          )}
        </div>

        {/* Sparkle effect on toggle */}
        {isTransitioning && (
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              background: isDark
                ? "radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(255,200,0,0.6) 0%, transparent 70%)",
              animation: "sparkle 0.3s ease-out",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes fadeInRotate {
          from { 
            opacity: 0; 
            transform: scale(0.5) rotate(-180deg); 
          }
          to { 
            opacity: 1; 
            transform: scale(1) rotate(0deg); 
          }
        }

        @keyframes pulse {
          0%, 100% { 
            transform: scale(1); 
            opacity: 0.6; 
          }
          50% { 
            transform: scale(1.1); 
            opacity: 0.8; 
          }
        }

        @keyframes sparkle {
          0% { 
            transform: scale(0); 
            opacity: 1; 
          }
          100% { 
            transform: scale(2); 
            opacity: 0; 
          }
        }

        /* Theme transition for the entire page */
        .theme-transition,
        .theme-transition * {
          transition: background-color 0.3s ease-in-out,
                      color 0.3s ease-in-out,
                      border-color 0.3s ease-in-out,
                      box-shadow 0.3s ease-in-out !important;
        }
      `}</style>
    </div>
  );
}
