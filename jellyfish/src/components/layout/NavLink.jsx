"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation"; // next-intl aware link
import React from "react";

const NavLink = ({
  href,
  exact = false,
  children,
  className = "",
  activeClassName = "active",
  ...props
}) => {
  const pathname = usePathname(); // e.g. /en/slug/123
  const locale = useLocale(); // e.g. en

  // remove locale prefix from current path
  const currentPath = pathname.replace(`/${locale}`, "") || "/";

  // get href as path string
  const hrefPath = typeof href === "string" ? href : href.pathname;

  // normalize both paths (remove trailing slash)
  const normalize = (path) =>
    path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;

  const isActive = exact
    ? normalize(currentPath) === normalize(hrefPath)
    : normalize(currentPath).startsWith(normalize(hrefPath));

  const combinedClassName = `${className} ${
    isActive ? activeClassName : ""
  }`.trim();

  return (
    <Link href={href} className={combinedClassName} {...props}>
      {children}
    </Link>
  );
};

export default NavLink;
