"use client";
import { useLocale, useTranslations } from "next-intl";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Navigation } from "swiper/modules";
import CategoryItem from "./CategoryItem";

// Import Swiper styles
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";

const Categories = ({ categories }) => {
  const t = useTranslations("categories");
  const locale = useLocale();
  const isRTL = locale === "ar";

  return (
    <>
      <div className="my-3">
        <div className="position-relative">
          <Swiper
            modules={[FreeMode, Navigation]}
            spaceBetween={10}
            slidesPerView="auto"
            freeMode={true}
            navigation={false}
            // navigation={{
            //   nextEl: isRTL
            //     ? ".swiper-button-prev-custom"
            //     : ".swiper-button-next-custom",
            //   prevEl: isRTL
            //     ? ".swiper-button-next-custom"
            //     : ".swiper-button-prev-custom",
            // }}
            dir={isRTL ? "rtl" : "ltr"}
            className="categories-swiper py-2"
            breakpoints={{
              320: {
                slidesPerView: 3.5,
                spaceBetween: 8,
              },
              480: {
                slidesPerView: 3.5,
                spaceBetween: 10,
              },
              560: {
                slidesPerView: 4.5,
                spaceBetween: 12,
              },
              640: {
                slidesPerView: 4.5,
                spaceBetween: 12,
              },
              768: {
                slidesPerView: 5.5,
                spaceBetween: 12,
              },
              800: {
                slidesPerView: 6.5,
                spaceBetween: 3,
              },
              991: {
                slidesPerView: 7.5,
                spaceBetween: 3,
              },
              991: {
                slidesPerView: 7.5,
                spaceBetween: 3,
              },
              992: {
                slidesPerView: 4.5,
                spaceBetween: 3,
              },
              1024: {
                slidesPerView: 4.5,
                spaceBetween: 3,
              },
              1290: {
                slidesPerView: 5.5,
                spaceBetween: 3,
              },
              1390: {
                slidesPerView: 6.5,
                spaceBetween: 3,
              },
              1480: {
                slidesPerView: 7.5,
                spaceBetween: 3,
              },
              1500: {
                slidesPerView: 8.5,
                spaceBetween: 3,
              },
              1660: {
                slidesPerView: 9.5,
                spaceBetween: 3,
              },
              1700: {
                slidesPerView: 10.5,
                spaceBetween: 3,
              },
            }}
          >
            {categories.map((category) => (
              <SwiperSlide key={category.id} className="!w-auto">
                <CategoryItem category={category} isRTL={isRTL} />
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Custom Navigation Buttons */}
          <div
            className={`swiper-button-prev-custom position-absolute top-50 translate-middle-y shadow rounded-circle d-flex align-items-center justify-content-center ${
              isRTL ? "end-0 me-2" : "start-0 ms-2"
            }`}
            style={{
              width: "40px",
              height: "40px",
              zIndex: 10,
              cursor: "pointer",
              border: "1px solid #e0e0e0",
            }}
          >
            <i
              className={`fa ${
                isRTL ? "fa-chevron-left" : "fa-chevron-right"
              } text-dark`}
            ></i>
          </div>

          <div
            className={`swiper-button-next-custom position-absolute top-50 translate-middle-y shadow rounded-circle d-flex align-items-center justify-content-center ${
              isRTL ? "start-0 ms-2" : "end-0 me-2"
            }`}
            style={{
              width: "40px",
              height: "40px",
              zIndex: 10,
              cursor: "pointer",
              border: "1px solid #e0e0e0",
            }}
          >
            <i
              className={`fa ${
                isRTL ? "fa-chevron-right" : "fa-chevron-left"
              } text-dark`}
            ></i>
          </div>
        </div>
      </div>

      {/* Custom CSS Styles */}
      <style jsx>{`
        .categories-swiper {
          padding: 0 50px;
        }

        .categories-swiper .swiper-slide {
          width: auto !important;
          flex-shrink: 0;
        }

        /* Hide navigation buttons on small screens */
        @media (max-width: 768px) {
          .swiper-button-prev-custom,
          .swiper-button-next-custom {
            display: none !important;
          }

          .categories-swiper {
            padding: 0;
          }
        }

        .swiper-button-prev-custom,
        .swiper-button-next-custom {
          background-color: --var(--bg-100) !important;
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          border: 1px solid var(--bg-300);
          color: var(--text-100) !important;

          i { color: var(--text-100) !important;}
        }
        /* Custom hover effects */
        .swiper-button-prev-custom:hover,
        .swiper-button-next-custom:hover {
          background-color: #f8f9fa !important;
          transform: translateY(-50%) scale(1.05);
          transition: all 0.2s ease;
        }
      `}</style>
    </>
  );
};

export default Categories;
