"use client";
import Image from "next/image";
import avatar from "../../../public/avatar.png";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import ThemeToggle from "../ui/ThemeToggle";
import { useTranslations } from "next-intl";
import logo from "../../../public/logoLight.png";
import logoDark from "../../../public/logoDark.png";
import Search from "./Search";
import { useEffect, useState } from "react";

const Navbar = () => {
  const t = useTranslations("nav");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // initial check
    setIsDark(document.documentElement.getAttribute("data-theme") === "dark");

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="pb-2">
      <div className="container-fluid">
        <div className="d-flex align-items-center justify-content-between flex-wrap">
          {/* Logo */}
          <div className="sayHi d-flex justify-content-sm-start justify-content-center flex-grow-1">
            <Image
              src={isDark ? logoDark : logo}
              alt="jelly fush logo"
              className="logo"
              priority
            />
          </div>

          {/* Search (desktop) */}
          <div className="d-none d-md-flex flex-grow-1 mx-3 justify-content-center align-items-center">
            <Search />
          </div>

          {/* Controls */}
          <div className="controls d-flex justify-content-sm-end justify-content-center align-items-center flex-grow-1">
            <LanguageSwitcher />
            <ThemeToggle />
            <Image
              src={avatar}
              width={50}
              height={50}
              alt="user Image"
              priority
            />
          </div>

          {/* Search (mobile) */}
          <div className="d-md-none flex-grow-1 mx-3 d-flex justify-content-center align-items-center">
            <Search />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
