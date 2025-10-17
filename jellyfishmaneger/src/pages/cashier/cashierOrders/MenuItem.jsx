import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import mealImage from "../../../assets/meal.jpg";
import riyalSymbol from "../../../assets/Saudi_Riyal_Symbol.png";
import MealTypeSelector from "./MealTypeSelector";
import QuantityControls from "./QuantityControls";

export default function MenuItem({ item, addToOrder }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  const lang = isRtl ? "ar" : "en";
  const {
    id,
    name,
    description,
    price,
    currency,
    category,
    availableTypes,
    unit,
    image,
    preparationTime,
    isPopular,
    tags,
  } = item;
    const [quantity, setQuantity] = useState(1);
    const [selectedType, setSelectedType] = useState(availableTypes[lang][0] || null);

  return (
    <>
      <div className="card menuItem">
        <header className="card-header">
          <img
            src={image}
            alt={`صورة ${name} - ${description}`}
            className="card-img-top"
            width="100%"
            sizes="(max-width: 576px) 100vw, (max-width: 768px) 50vw, (max-width: 992px) 33vw, (max-width: 1200px) 25vw, 300px"
            // loading={priority ? "eager" : "lazy"}
            // priority={priority}
            placeholder="blur"
            style={{
              width: "100%",
              height: "auto",
              objectFit: "cover",
            }}
            itemProp="image"
          />
          {isPopular && (
            <span className="badge bg-warning text-dark position-absolute top-0 start-0 m-2">
              {isRtl ? "مميز ⭐" : "Popular ⭐"}
            </span>
          )}
        </header>

        <div className="card-body">
          <h6 className="card-title " itemProp="name">
            {isRtl ? name.ar : name.en}
          </h6>
          <div className="d-flex justify-content-between">
            {preparationTime && (
              <p className="text-muted small mb-2">
                ⏱️ {isRtl ? preparationTime.ar : preparationTime.en}{" "}
              </p>
            )}

            <div
              className="price d-flex align-items-center mb-1"
              itemProp="offers"
              itemScope
              itemType="https://schema.org/Offer"
            >
              <span itemProp="price">{price}</span>
              <meta itemProp="priceCurrency" content={currency} />
              <img
                src={riyalSymbol}
                alt="رمز الريال السعودي"
                className="riyal-symbol ms-1"
                width={16}
                height={16}
                loading="lazy"
              />
            </div>
          </div>

          {/* Client Component للتفاعل */}
          <MealTypeSelector types={availableTypes} isRtl={isRtl} selectedType={selectedType} setSelectedType={setSelectedType} />
        </div>
        <div className="card-footer d-flex justify-content-between align-items-center">
          <QuantityControls unit={unit} lang={lang} quantity={quantity} setQuantity={setQuantity} />
          <div>
            <button
              className="btn btn-primary add-to-order"
              onClick={() => addToOrder(item, quantity, selectedType)}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
