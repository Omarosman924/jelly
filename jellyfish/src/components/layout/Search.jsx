import { useTranslations } from "next-intl";
import React from "react";

export default function Search() {
      const t = useTranslations("nav");
  return (
    <div className="search">
      <input
        type="search"
        className="form-control form-control-search"
        placeholder={t("search")}
      />
    </div>
  );
}
