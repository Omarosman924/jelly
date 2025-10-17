"use client";
import { useEffect } from "react";
import { useLocale } from "next-intl";

export default function BootstrapStyle() {
  const locale = useLocale() || "ar";
  const isRTL = locale !== "en";

  useEffect(() => {
    // ضبط الاتجاه واللغة
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = locale;

    // شيل أي Bootstrap CSS قديم
    const oldLinks = document.querySelectorAll('link[data-bootstrap="true"]');
    oldLinks.forEach((link) => link.remove());

    // أضف Bootstrap CSS الجديد من public
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = isRTL
      ? "/bootstrap/css/bootstrap.rtl.min.css"
      : "/bootstrap/css/bootstrap.min.css";
    link.setAttribute("data-bootstrap", "true");
    document.head.appendChild(link);

    // تحميل Bootstrap JS مرة واحدة فقط
    if (!window.bootstrap) {
      const script = document.createElement("script");
      script.src = "/bootstrap/js/bootstrap.bundle.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [isRTL, locale]);

  return null;
}
