// components/Menu.jsx
import { useLocale } from "next-intl";
import Categories from "@/components/home/category/Categories";
import MenuItem from "./MenuItem";
import mealImage from "@/../public/mael.jpg";

// البيانات لازم تيجي من API أو database في الواقع
const categories = [
  { id: 1, name: { en: "favorites", ar: "المفضلة" }, icon: "fa fa-heart" },
  { id: 2, name: { en: "meals", ar: "الوجبات" }, icon: "fa fa-bowl-food" },
  {
    id: 3,
    name: { en: "family", ar: "وجبات عائلية" },
    icon: "fa fa-users",
  },
  { id: 4, name: { en: "fish", ar: "سمك" }, icon: "fa fa-fish" },
  { id: 5, name: { en: "soups", ar: "الشوربات" }, icon: "fa fa-mug-hot" },
  { id: 6, name: { en: "salads", ar: "السلطات" }, icon: "fa-regular fa-lemon" },
  { id: 7, name: { en: "desserts", ar: "الحلويات" }, icon: "fa fa-ice-cream" },
  {
    id: 8,
    name: { en: "drinks", ar: "المشروبات" },
    icon: "fa-solid fa-martini-glass-citrus",
  },
  { id: 9, name: { en: "sandwiches", ar: "السندويشات" }, icon: "fa fa-burger" },
  { id: 10, name: { en: "crustaceans", ar: "القشريات" }, icon: "fa fa-shrimp" },
];

// بيانات تجريبية للمنتجات - في الواقع هتيجي من API
const menuItems = [
  {
    id: "grilled-chicken",
    name: { en: "Grilled Chicken", ar: "دجاج مشوي" },
    description: {
      en: "Fresh grilled chicken with special spices and vegetables",
      ar: "دجاج طازج مشوي على الفحم مع التوابل الخاصة والخضروات",
    },
    price: 25,
    currency: "SAR",
    category: "meals",
    availableTypes: {
      ar: ["مشوي", "مقلي", "صنية"],
      en: ["Grilled", "Fried", "Casserole"],
    },
    unit: { ar: "كيلو", en: "Kilogram" },
    image: mealImage,
    isPopular: true,
    preparationTime: { ar: "15-20 دقيقة", en: "15-20 minutes" },
    tags: ["chicken", "grilled", "popular"],
  },
  {
    id: "fish-fillet",
    name: { en: "Fish Fillet", ar: "فيليه سمك" },
    description: {
      en: "Fresh fish fillet with lemon and herbs",
      ar: "فيليه سمك طازج مع الليمون والأعشاب الطبيعية",
    },
    price: 35,
    currency: "SAR",
    category: "fish",
    availableTypes: { ar: ["مشوي", "مقلي"], en: ["Grilled", "Fried"] },
    unit: { ar: "قطعة", en: "Piece" },
    image: mealImage,
    isPopular: false,
    preparationTime: { ar: "10-15 دقيقة", en: "10-15 minutes" },
    tags: ["fish", "healthy", "protein"],
  },
  {
    id: "family-meal",
    name: { en: "Family Meal", ar: "وجبة عائلية مشكلة" },
    description: {
      en: "A complete meal for 4-6 people with rice and salad",
      ar: "وجبة كاملة تكفي 4-6 أشخاص مع الأرز والسلطة",
    },
    price: 85,
    currency: "SAR",
    category: "family",
    availableTypes: {
      ar: ["مشوي", "مقلي", "صنية"],
      en: ["Grilled", "Fried", "Casserole"],
    },
    unit: { ar: "وجبة", en: "Meal" },
    image: mealImage,
    isPopular: true,
    preparationTime: { ar: "25-30 دقيقة", en: "25-30 minutes" },
    tags: ["family", "complete", "popular"],
  },
  {
    id: "lentil-soup",
    name: { en: "Lentil Soup", ar: "شوربة عدس" },
    description: {
      en: "Red lentil soup with vegetables and authentic Arabic spices",
      ar: "شوربة عدس أحمر بالخضروات والتوابل العربية الأصيلة",
    },
    price: 12,
    currency: "SAR",
    category: "soups",
    availableTypes: { ar: ["عادي", "حار"], en: ["Regular", "Spicy"] },
    unit: { ar: "كوب", en: "Cup" },
    image: mealImage,
    isPopular: false,
    preparationTime: { ar: "5 دقائق", en: "5 minutes" },
    tags: ["soup", "healthy", "vegetarian"],
  },
  {
    id: "caesar-salad",
    name: { en: "Caesar Salad", ar: "سلطة سيزر" },
    description: {
      en: "Classic Caesar salad with lettuce and Parmesan cheese",
      ar: "سلطة سيزر كلاسيكية مع الخس والجبن البارميزان",
    },
    price: 18,
    currency: "SAR",
    category: "salads",
    availableTypes: {
      ar: ["مع دجاج", "بدون دجاج"],
      en: ["With Chicken", "Without Chicken"],
    },
    unit: { ar: "طبق", en: "Plate" },
    image: mealImage,
    isPopular: true,
    preparationTime: { ar: "5 دقائق", en: "5 minutes" },
    tags: ["salad", "fresh", "popular"],
  },
  {
    id: "chocolate-cake",
    name: { en: "Chocolate Cake", ar: "كيك شوكولاتة" },
    description: {
      en: "Rich and delicious chocolate cake with chocolate cream",
      ar: "كيك شوكولاتة غني ولذيذ مع كريمة الشوكولاتة",
    },
    price: 22,
    currency: "SAR",
    category: "desserts",
    availableTypes: { ar: ["عادي", "بالمكسرات"], en: ["Regular", "With Nuts"] },
    unit: { ar: "قطعة", en: "Piece" },
    image: mealImage,
    isPopular: true,
    preparationTime: { ar: "3 دقائق", en: "3 minutes" },
    tags: ["dessert", "chocolate", "sweet"],
  },
  {
    id: "fresh-juice",
    name: { en: "Fresh Juice", ar: "عصير طازج" },
    description: {
      en: "Carefully selected fresh fruit juice",
      ar: "عصير فواكه طازجة مختارة بعناية",
    },
    price: 8,
    currency: "SAR",
    category: "drinks",
    availableTypes: {
      ar: ["برتقال", "تفاح", "مشكل"],
      en: ["Orange", "Apple", "Mixed"],
    },
    unit: { ar: "كوب", en: "Cup" },
    image: mealImage,
    isPopular: false,
    preparationTime: { ar: "2 دقائق", en: "2 minutes" },
    tags: ["juice", "fresh", "healthy"],
  },
  {
    id: "chicken-sandwich",
    name: { en: "Chicken Sandwich", ar: "ساندويش دجاج" },
    description: {
      en: "Grilled chicken sandwich with vegetables and special sauce",
      ar: "ساندويش دجاج مشوي مع الخضروات والصوص الخاص",
    },
    price: 15,
    currency: "SAR",
    category: "sandwiches",
    availableTypes: { ar: ["حار", "عادي"], en: ["Spicy", "Regular"] },
    unit: { ar: "ساندويش", en: "Sandwich" },
    image: mealImage,
    isPopular: true,
    preparationTime: { ar: "8-10 دقائق", en: "8-10 minutes" },
    tags: ["sandwich", "chicken", "quick"],
  },
  {
    id: "grilled-shrimp",
    name: { en: "Grilled Shrimp", ar: "جمبري مشوي" },
    description: {
      en: "Fresh grilled shrimp with garlic and lemon",
      ar: "جمبري طازج مشوي مع الثوم والليمون",
    },
    price: 45,
    currency: "SAR",
    category: "crustaceans",
    availableTypes: { ar: ["مشوي", "مقلي"], en: ["Grilled", "Fried"] },
    unit: { ar: "طبق", en: "Plate" },
    image: mealImage,
    isPopular: true,
    preparationTime: { ar: "12-15 دقيقة", en: "12-15 minutes" },
    tags: ["shrimp", "seafood", "premium"],
  },
  {
    id: "mixed-grill",
    name: { en: "Mixed Grill", ar: "مشاوي مشكلة" },
    description: {
      en: "A selection of the best grills with rice and salad",
      ar: "تشكيلة من أفضل المشاوي مع الأرز والسلطة",
    },
    price: 38,
    currency: "SAR",
    category: "meals",
    availableTypes: { ar: ["مشوي"], en: ["Grilled"] },
    unit: { ar: "طبق", en: "Plate" },
    image: mealImage,
    isPopular: true,
    preparationTime: { ar: "20-25 دقيقة", en: "20-25 minutes" },
    tags: ["grill", "mixed", "popular"],
  },
];

const Menu = ({
  selectedCategory = null,
  searchQuery = "",
  apiMenuItems = null,
}) => {
  const locale = useLocale();

  // استخدام البيانات من API لو متوفرة، وإلا استخدم البيانات التجريبية
  const currentMenuItems = apiMenuItems || menuItems;

  // دالة للحصول على النص بناءً على اللغة
  const getText = (textObj, fallback = "") => {
    if (typeof textObj === "object" && textObj !== null) {
      return textObj[locale] || textObj.ar || textObj.en || fallback;
    }
    return textObj || fallback;
  };

  // فلترة المنتجات حسب الفئة المحددة
  const filteredItems = currentMenuItems.filter((item) => {
    const matchesCategory =
      !selectedCategory || item.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      getText(item.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
      getText(item.description)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      item.tags?.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );

    return matchesCategory && matchesSearch;
  });

  // الحصول على اسم الفئة المحددة
  const getSelectedCategoryName = () => {
    const category = categories.find(
      (cat) => cat.name.en.toLowerCase() === selectedCategory?.toLowerCase()
    );
    return category
      ? getText(category.name)
      : locale === "ar"
      ? "المنتجات"
      : "Products";
  };

  // JSON-LD schema للقائمة كاملة
  const menuSchema = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: locale === "ar" ? "قائمة المطعم" : "Restaurant Menu",
    description:
      locale === "ar"
        ? "قائمة شاملة بجميع الأطباق والمشروبات المتوفرة"
        : "Comprehensive menu of all available dishes and beverages",
    provider: {
      "@type": "Restaurant",
      name: locale === "ar" ? "اسم المطعم" : "Restaurant Name",
    },
    hasMenuSection: categories.map((category) => ({
      "@type": "MenuSection",
      "@id": `#${category.name.en}`,
      name: getText(category.name),
      description:
        locale === "ar"
          ? `قسم ${getText(category.name)}`
          : `${getText(category.name)} Section`,
      hasMenuItem: filteredItems
        .filter((item) => item.category === category.name.en.toLowerCase())
        .map((item) => ({
          "@type": "MenuItem",
          "@id": `#${item.id}`,
          name: getText(item.name),
          description: getText(item.description),
          offers: {
            "@type": "Offer",
            price: item.price,
            priceCurrency: item.currency,
          },
        })),
    })),
  };

  return (
    <>
      {/* JSON-LD Schema للقائمة */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(menuSchema),
        }}
      />

      {/* قسم الفئات */}
      <Categories categories={categories} />

      {/* قسم المنتجات */}
      <main className="my-3 container-fluid">
        {/* عنوان للـ SEO */}
        <div className="row mb-3">
          <div className="col-12">
            <h2 className="h3 text-center mb-0">
              {selectedCategory
                ? `${
                    locale === "ar" ? "قائمة" : "Menu"
                  } ${getSelectedCategoryName()}`
                : locale === "ar"
                ? "قائمة المطعم الكاملة"
                : "Complete Restaurant Menu"}
            </h2>
            {searchQuery && (
              <p className="text-muted text-center mt-2">
                {locale === "ar"
                  ? `نتائج البحث عن: "${searchQuery}" (${filteredItems.length} منتج)`
                  : `Search results for: "${searchQuery}" (${filteredItems.length} items)`}
              </p>
            )}
          </div>
        </div>

        {/* شبكة المنتجات */}
        <div className="row g-3" id="menu-items">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) =>
              filteredItems.map((item, index) => (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  name={getText(item.name)}
                  description={getText(item.description)}
                  price={item.price}
                  currency={item.currency}
                  image={item.image}
                  availableTypes={getText(item.availableTypes, [])}
                  unit={getText(item.unit)}
                  priority={index < 4}
                  isPopular={item.isPopular}
                  preparationTime={getText(item.preparationTime)}
                  locale={locale}
                />
              ))
            )
          ) : (
            <div className="col-12">
              <div className="text-center py-5">
                <h3 className="h5 text-muted">
                  {locale === "ar"
                    ? "لا توجد منتجات متاحة"
                    : "No products available"}
                </h3>
                <p className="text-muted">
                  {searchQuery
                    ? locale === "ar"
                      ? "جرب البحث بكلمات أخرى"
                      : "Try searching with different keywords"
                    : locale === "ar"
                    ? "سيتم إضافة منتجات جديدة قريباً"
                    : "New products will be added soon"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* معلومات إضافية للـ SEO */}
        <aside className="row mt-4">
          <div className="col-12">
            <div className="card bg-light">
              <div className="card-body">
                <h3 className="h6 card-title">
                  {locale === "ar" ? "معلومات القائمة" : "Menu Information"}
                </h3>
                <ul className="list-unstyled mb-0 small text-muted">
                  {locale === "ar" ? (
                    <>
                      <li>• جميع الأطباق طازجة ومحضرة يومياً</li>
                      <li>• أوقات التحضير تقريبية وقد تختلف حسب الطلب</li>
                      <li>• الأسعار شاملة ضريبة القيمة المضافة</li>
                      <li>• متوفر خدمة التوصيل لجميع أنحاء المدينة</li>
                    </>
                  ) : (
                    <>
                      <li>• All dishes are fresh and prepared daily</li>
                      <li>
                        • Preparation times are approximate and may vary by
                        order
                      </li>
                      <li>• Prices include VAT</li>
                      <li>• Delivery service available throughout the city</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </>
  );
};

export default Menu;
