import React from "react";
import LanguageToggle from "../ui/LanguageToggle";
import ThemeToggle from "../ui/ThemeToggle";
import { useTranslation } from "react-i18next";
import avatar from "../../assets/avatar.png";
import { Link } from "react-router-dom";

export default function Controls() {
  const { t } = useTranslation();
  return (
    <div className="controls d-flex align-items-center gap-3">
      <div className="dropdown">
        <img
          src={avatar}
          alt="User Avatar"
          width={40}
          height={40}
          data-bs-toggle="dropdown"
          aria-expanded="false"
        />
        <ul className="dropdown-menu">
          <li>
            <p className="dropdown-item fw-bold textPrimary fs-4 mb-0">
              {t("sayHello")} أحمد
            </p>
          </li>
          <li>
            <Link className="dropdown-item" to="/profile">
              {t("profile")}
            </Link>
          </li>
          <li>
            <button
              className="w-100 mt-2 btn btn-danger"
              onClick={() => {
                /* Handle logout */
              }}
            >
              {t("logout")}
            </button>
          </li>
        </ul>
      </div>
      <LanguageToggle />
      <ThemeToggle />
    </div>
  );
}
