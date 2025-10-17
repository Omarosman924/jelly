import { useEffect, useState } from "react";
import logo from "../../assets/logo.png";
import darkLogo from "../../assets/dark-logo.png";

export default function Logo() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const checkTheme = () => {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) {
        setIsDarkMode(savedTheme === "dark");
      } else {
        setIsDarkMode(mediaQuery.matches);
      }
    };

    // Check theme on mount
    checkTheme();

    // Listen for system preference changes
    const handleSystemChange = (e) => setIsDarkMode(e.matches);

    // Listen for storage changes
    window.addEventListener("storage", checkTheme);

    // Listen for manual theme changes
    const handleThemeChange = (e) => setIsDarkMode(e.detail.isDark);
    window.addEventListener("themeChange", handleThemeChange);

    // Listen for system dark/light changes
    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      window.removeEventListener("storage", checkTheme);
      window.removeEventListener("themeChange", handleThemeChange);
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, []);

  return (
    <div className="logo">
      <img
        src={isDarkMode ? darkLogo : logo}
        alt={
          isDarkMode
            ? "Jelly Fish Manager Dark Logo"
            : "Jelly Fish Manager Light Logo"
        }
        className="logo-image"
      />
    </div>
  );
}
