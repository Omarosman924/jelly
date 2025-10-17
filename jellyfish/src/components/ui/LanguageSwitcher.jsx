"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { FaGlobe } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const changeLanguage = () => {
    const newLocale = locale === "ar" ? "en" : "ar";
    const newPath = `/${newLocale}${pathname.substring(3) || ""}`;
    router.push(newPath);
  };

  return (
    <motion.button
      onClick={changeLanguage}
      className="btn btn-outline-primary d-flex align-items-center justify-content-center gap-2"
      style={{ borderRadius: "50px", width: "80px" }}
      whileTap={{ scale: 0.9 }}
    >
      <motion.div
        key={locale} // عشان يلف مع التغيير
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.6 }}
      >
        <FaGlobe />
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={locale}
          initial={{ opacity: 0, y: -10, rotateX: 90 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, y: 10, rotateX: -90 }}
          transition={{ duration: 0.4 }}
        >
          {locale === "ar" ? "EN" : "ع"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
