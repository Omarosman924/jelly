import { useState, useEffect } from "react";
import LoadingScreen from "./LoadingScreen";

const LoadingWrapper = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const loadResources = async () => {
      try {
        // Load critical resources
        await Promise.all([
          // Wait for fonts to load
          document.fonts.ready,

          // Initialize language settings
          new Promise((resolve) => {
            const savedLang = localStorage.getItem("preferredLanguage") || "ar";
            document.documentElement.lang = savedLang;
            document.documentElement.dir = savedLang === "ar" ? "rtl" : "ltr";
            resolve();
          }),

          // Initialize theme before render
          new Promise((resolve) => {
            const savedTheme = localStorage.getItem("theme");
            const prefersDark = window.matchMedia(
              "(prefers-color-scheme: dark)"
            ).matches;
            const shouldUseDark = savedTheme
              ? savedTheme === "dark"
              : prefersDark;

            if (shouldUseDark) {
              document.documentElement.setAttribute("data-theme", "dark");
              document.body.classList.add("dark-theme");
            } else {
              document.documentElement.removeAttribute("data-theme");
              document.body.classList.remove("dark-theme");
            }
            resolve();
          }),

          // Minimum display time for better UX (prevents flash)
          new Promise((resolve) => setTimeout(resolve, 1500)),

          // You can add other checks here:
          // - API health check
          // - Authentication state
          // - Critical data fetching
        ]);

        // Start fade out animation
        setFadeOut(true);

        // Wait for animation to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        setIsLoading(false);
      } catch (error) {
        console.error("Error loading resources:", error);

        // On error, still hide loading after delay
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(() => setIsLoading(false), 500);
        }, 1000);
      }
    };

    loadResources();
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          opacity: fadeOut ? 0 : 1,
          transition: "opacity 0.5s ease-out",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100vh",
          zIndex: 9999,
        }}
      >
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div
      style={{
        opacity: 1,
        animation: "fadeIn 0.3s ease-in",
      }}
    >
      {children}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LoadingWrapper;
