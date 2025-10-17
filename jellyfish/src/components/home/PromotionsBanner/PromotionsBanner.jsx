"use client";
import { useLocale } from "next-intl";
import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import styles from "./PromotionsBanner.module.css";

const PromotionsBanner = ({ promotions = [] }) => {
  const locale = useLocale();
  const isRTL = locale === "ar";
  
  // بيانات تجريبية للعروض (الصور فقط)
  const getDefaultPromotions = () => [
    {
      id: 1,
      image:
        "https://thumbs.dreamstime.com/b/rustic-omelette-feta-spinach-placed-dark-wood-surface-creating-warm-intimate-mood-perfect-savory-breakfast-385987347.jpg",
    },
    {
      id: 2,
      image:
        "https://www.shutterstock.com/image-photo/healthy-breakfast-food-table-scene-260nw-2252477835.jpg",
    },
    {
      id: 3,
      image:
        "https://thumbs.dreamstime.com/b/savory-omelette-fresh-spinach-feta-sun-dried-tomatoes-nutritious-meal-banner-savory-omelette-fresh-spinach-383476433.jpg",
    },
  ];

  const slidesData =
    promotions.length > 0 ? promotions : getDefaultPromotions();

  // إعدادات Swiper
  const swiperConfig = {
    modules: [Navigation, Pagination, Autoplay],
    spaceBetween: 0,
    slidesPerView: 1,
    navigation: true,
    pagination: {
      clickable: true,
      dynamicBullets: true,
    },
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    loop: true,
    direction: "horizontal",
    rtl: `${isRTL}`,
  };

  if (slidesData.length === 1) {
    const promotion = slidesData[0];
    return (
      <div
        className={`${styles.promotionBanner} ${isRTL ? styles.rtl : ""}`}
        style={{ direction: isRTL ? "rtl" : "ltr" }}
      >
        <div className={styles.bannerContainer}>
          <div className={styles.bannerImageWrapper}>
            <img
              src={promotion.image}
              alt="Promotion"
              className={styles.bannerImage}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.promotionBanner} ${isRTL ? styles.rtl : ""}`}
      style={{ direction: isRTL ? "rtl" : "ltr" }}
    >
      <div className={styles.swiperContainer}>
        <Swiper {...swiperConfig}>
          {slidesData.map((promotion) => (
            <SwiperSlide key={promotion.id}>
              <div className={styles.slideWrapper}>
                <img
                  src={promotion.image}
                  alt="Promotion"
                  className={styles.bannerImage}
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
};

export default PromotionsBanner;
