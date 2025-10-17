// components/MenuItem.jsx (Server Component)
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import mealImage from "@/../public/mael.jpg";
import riyalSymbol from "@/../public/Saudi_Riyal_Symbol.png";
import MealTypeSelector from "./MealTypeSelector";
import QuantityControls from "./QuantityControls";
import AddToOrderButton from "./AddToOrderButton";

const MenuItem = ({
  id = "meal-001",
  name = "اسم الوجبة", // من API
  description = "وصف الوجبة الشهية المطبوخة بأفضل المكونات الطازجة", // من API
  price = 10,
  currency = "SAR",
  image = mealImage, // استخدام static import مباشرة
  availableTypes = ["مشوي", "مقلي", "صنية"], // من API
  unit = "كيلو", // من API
  priority = false,
  isPopular = false,
  preparationTime = "10-15 دقيقة", // من API
}) => {
  const t = useTranslations();
  const locale = useLocale();
  const isRtl = locale === "ar";

  return (
    <>


      <article className="col-sm-6 col-md-4 col-lg-6 col-xl-4 col-xxl-3">
        <div
          className="card menuItem"
          itemScope
          itemType="https://schema.org/MenuItem"
        >
          <header className="card-header">
            <Image
              src={image}
              alt={`صورة ${name} - ${description}`} 
              className="card-img-top"
              width={300}
              height={200}
              sizes="(max-width: 576px) 100vw, (max-width: 768px) 50vw, (max-width: 992px) 33vw, (max-width: 1200px) 25vw, 300px"
              loading={priority ? "eager" : "lazy"}
              priority={priority}
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
            <h3 className="card-title h5" itemProp="name">
              {name}
            </h3>

            <p className="card-text mb-1" itemProp="description">
              {description}
            </p>

            {preparationTime && (
              <p className="text-muted small mb-2">
                ⏱️ {t("menu.item.prepTime")}: {preparationTime}
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
              <Image
                src={riyalSymbol}
                alt="رمز الريال السعودي"
                className="riyal-symbol ms-1"
                width={16}
                height={16}
                loading="lazy"
              />
            </div>

            <p className="mb-1">
              <strong>{isRtl ? "كيف تحبها؟" : "How do you prefer it?"}</strong>
            </p>

            {/* Client Component للتفاعل */}
            <MealTypeSelector
              types={availableTypes}
              defaultSelected={availableTypes[0]}
              itemId={id}
              locale={locale}
            />

            {/* Client Component للكمية */}
            <QuantityControls
              unit={unit}
              itemId={id}
              min={1}
              max={10}
              defaultValue={1}
              locale={locale}
            />

            {/* Client Component للإضافة */}
            <AddToOrderButton
              itemId={id}
              itemName={name}
              price={price}
              currency={currency}
              locale={locale}
            />
          </div>
        </div>
      </article>
    </>
  );
};

export default MenuItem;
