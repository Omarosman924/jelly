"use client";

import { useState, useEffect } from "react";
import LoadingScreen from "./LoadingScreen";

const LoadingWrapper = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // محاكاة تحميل الكومبوننتس والموارد
    const loadResources = async () => {
      try {
        // انتظار تحميل Bootstrap و الـ components الأساسية
        await Promise.all([
          // // تحميل Bootstrap CSS
          // import("bootstrap/dist/css/bootstrap.min.css"),
          // // تحميل Bootstrap JS
          // import("bootstrap/dist/js/bootstrap.bundle.min.js"),
          // // انتظار قصير للتأكد من تحميل كل شيء
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);

        // بدء الـ fade out animation
        setFadeOut(true);

        // انتظار انتهاء الـ animation قبل إخفاء الـ loading
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      } catch (error) {
        console.error("Error loading resources:", error);
        // في حالة الخطأ، إخفاء الـ loading بعد وقت معين
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(() => setIsLoading(false), 500);
        }, 2000);
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
        transition: "opacity 0.3s ease-in",
      }}
    >
      {children}
    </div>
  );
};

export default LoadingWrapper;
