// utils/imageUtils.js

// Static imports للصور المختلفة
import mealImage1 from "@/../public/mael.jpg";
import mealImage2 from "@/../public/meal2.jpg"; // لو عندك صور أكتر
import mealImage3 from "@/../public/meal3.jpg";
// ... المزيد من الصور

// دالة لتوليد blurDataURL بسيط
const generateBlurDataURL = (width = 8, height = 8) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // لون رمادي فاتح كـ placeholder
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL();
};

// Base64 blur placeholder جاهز (أفضل للـ performance)
const DEFAULT_BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyugDY4/wB1PSX9hI9dNvBJtdwUYD/FBgBnyj9n1EERY9mhvklwJgLsJkL5bwepGwGgPs+tWRKtvPilQ/hWcRaN9gMlw5oULxG+HtGGPyzWjuI9P+ApnSHCnFqYWU11WkGpgUMYDqc";

// object للصور مع الـ blur data
export const menuImages = {
  default: {
    src: mealImage1,
    blurDataURL: DEFAULT_BLUR_DATA_URL,
  },
  meal1: {
    src: mealImage1,
    blurDataURL: DEFAULT_BLUR_DATA_URL,
  },
  meal2: {
    src: mealImage2,
    blurDataURL: DEFAULT_BLUR_DATA_URL,
  },
  meal3: {
    src: mealImage3,
    blurDataURL: DEFAULT_BLUR_DATA_URL,
  },
};

// دالة للحصول على صورة مع blur
export const getImageWithBlur = (imageName = "default") => {
  return menuImages[imageName] || menuImages.default;
};

// Hook لاستخدام الصور (اختياري)
export const useMenuImage = (imageName) => {
  return getImageWithBlur(imageName);
};
