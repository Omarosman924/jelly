import { useState } from "react";
import CheckOut from "./CheckOut";
import Menu from "./Menu";
import mealImage from "../../../assets/meal.jpg";
import { useLocalStorage } from "../../../hooks/useLocalStorage";

const menu = [
  {
    id: 1,
    name: { en: "Main Meals", ar: "الوجبات الرئيسية" },
    icon: "fa fa-utensils",
    items: [
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
      {
        id: "falafel-plate",
        name: { en: "Falafel Plate", ar: "طبق فلافل" },
        description: {
          en: "Crispy falafel with tahini, vegetables, and pickles",
          ar: "فلافل مقرمش مع الطحينة والخضروات والمخللات",
        },
        price: 16,
        currency: "SAR",
        category: "meals",
        availableTypes: { ar: ["عادي", "حار"], en: ["Regular", "Spicy"] },
        unit: { ar: "طبق", en: "Plate" },
        image: mealImage,
        isPopular: true,
        preparationTime: { ar: "7-10 دقائق", en: "7-10 minutes" },
        tags: ["falafel", "vegetarian", "traditional"],
      },
      {
        id: "chicken-nuggets",
        name: { en: "Chicken Nuggets", ar: "ناجتس دجاج" },
        description: {
          en: "Crispy chicken nuggets with special sauce",
          ar: "قطع دجاج مقرمشة مع الصوص الخاص",
        },
        price: 18,
        currency: "SAR",
        category: "meals",
        availableTypes: {
          ar: ["6 قطع", "9 قطع", "12 قطعة"],
          en: ["6 pieces", "9 pieces", "12 pieces"],
        },
        unit: { ar: "صحن", en: "Plate" },
        image: mealImage,
        isPopular: true,
        preparationTime: { ar: "8-10 دقائق", en: "8-10 minutes" },
        tags: ["chicken", "kids", "crispy"],
      },
      {
        id: "grilled-lamb",
        name: { en: "Grilled Lamb", ar: "لحم غنم مشوي" },
        description: {
          en: "Tender grilled lamb with special spices and rice",
          ar: "لحم غنم طري مشوي مع التوابل الخاصة والأرز",
        },
        price: 55,
        currency: "SAR",
        category: "meals",
        availableTypes: { ar: ["مشوي", "مندي"], en: ["Grilled", "Mandi"] },
        unit: { ar: "كيلو", en: "Kilogram" },
        image: mealImage,
        isPopular: true,
        preparationTime: { ar: "20-25 دقيقة", en: "20-25 minutes" },
        tags: ["lamb", "grilled", "premium"],
      },
    ],
  },
  {
    id: 2,
    name: { en: "Seafood", ar: "المأكولات البحرية" },
    icon: "fa fa-fish",
    items: [
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
    ],
  },
  {
    id: 3,
    name: { en: "Sandwiches", ar: "السندويشات" },
    icon: "fa fa-hamburger",
    items: [
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
        id: "beef-burger",
        name: { en: "Beef Burger", ar: "برجر لحم" },
        description: {
          en: "Juicy beef burger with cheese, lettuce, and tomato",
          ar: "برجر لحم شهي مع الجبن والخس والطماطم",
        },
        price: 28,
        currency: "SAR",
        category: "sandwiches",
        availableTypes: {
          ar: ["عادي", "دبل", "سبايسي"],
          en: ["Regular", "Double", "Spicy"],
        },
        unit: { ar: "ساندويش", en: "Sandwich" },
        image: mealImage,
        isPopular: true,
        preparationTime: { ar: "10-12 دقيقة", en: "10-12 minutes" },
        tags: ["burger", "beef", "popular"],
      },
    ],
  },
  {
    id: 4,
    name: { en: "Salads", ar: "السلطات" },
    icon: "fa fa-leaf",
    items: [
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
        id: "tuna-salad",
        name: { en: "Tuna Salad", ar: "سلطة تونة" },
        description: {
          en: "Fresh tuna salad with lettuce, corn, and olives",
          ar: "سلطة تونة طازجة مع الخس والذرة والزيتون",
        },
        price: 20,
        currency: "SAR",
        category: "salads",
        availableTypes: {
          ar: ["عادي", "بالأفوكادو"],
          en: ["Regular", "With Avocado"],
        },
        unit: { ar: "طبق", en: "Plate" },
        image: mealImage,
        isPopular: false,
        preparationTime: { ar: "5 دقائق", en: "5 minutes" },
        tags: ["salad", "tuna", "protein"],
      },
      {
        id: "greek-salad",
        name: { en: "Greek Salad", ar: "سلطة يونانية" },
        description: {
          en: "Fresh Greek salad with feta cheese and olives",
          ar: "سلطة يونانية طازجة مع جبن الفيتا والزيتون",
        },
        price: 19,
        currency: "SAR",
        category: "salads",
        availableTypes: { ar: ["عادي", "كبيرة"], en: ["Regular", "Large"] },
        unit: { ar: "طبق", en: "Plate" },
        image: mealImage,
        isPopular: false,
        preparationTime: { ar: "5 دقائق", en: "5 minutes" },
        tags: ["salad", "greek", "fresh"],
      },
    ],
  },
  {
    id: 5,
    name: { en: "Soups", ar: "الشوربات" },
    icon: "fa fa-bowl-hot",
    items: [
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
        id: "vegetable-soup",
        name: { en: "Vegetable Soup", ar: "شوربة خضار" },
        description: {
          en: "Healthy vegetable soup with seasonal vegetables",
          ar: "شوربة خضار صحية بالخضروات الموسمية الطازجة",
        },
        price: 10,
        currency: "SAR",
        category: "soups",
        availableTypes: { ar: ["عادي", "كريمي"], en: ["Regular", "Creamy"] },
        unit: { ar: "كوب", en: "Cup" },
        image: mealImage,
        isPopular: false,
        preparationTime: { ar: "5 دقائق", en: "5 minutes" },
        tags: ["soup", "vegetarian", "healthy"],
      },
    ],
  },
  {
    id: 6,
    name: { en: "Drinks", ar: "المشروبات" },
    icon: "fa fa-glass-water",
    items: [
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
        id: "mango-smoothie",
        name: { en: "Mango Smoothie", ar: "سموذي مانجو" },
        description: {
          en: "Refreshing mango smoothie with milk and honey",
          ar: "سموذي مانجو منعش بالحليب والعسل",
        },
        price: 14,
        currency: "SAR",
        category: "drinks",
        availableTypes: {
          ar: ["عادي", "بالآيس كريم"],
          en: ["Regular", "With Ice Cream"],
        },
        unit: { ar: "كوب", en: "Cup" },
        image: mealImage,
        isPopular: true,
        preparationTime: { ar: "3 دقائق", en: "3 minutes" },
        tags: ["smoothie", "mango", "refreshing"],
      },
      {
        id: "iced-coffee",
        name: { en: "Iced Coffee", ar: "قهوة مثلجة" },
        description: {
          en: "Cold coffee with milk and ice",
          ar: "قهوة باردة مع الحليب والثلج",
        },
        price: 12,
        currency: "SAR",
        category: "drinks",
        availableTypes: {
          ar: ["لاتيه", "موكا", "كراميل"],
          en: ["Latte", "Mocha", "Caramel"],
        },
        unit: { ar: "كوب", en: "Cup" },
        image: mealImage,
        isPopular: true,
        preparationTime: { ar: "4 دقائق", en: "4 minutes" },
        tags: ["coffee", "cold", "caffeine"],
      },
    ],
  },
  {
    id: 7,
    name: { en: "Desserts", ar: "الحلويات" },
    icon: "fa fa-cake-candles",
    items: [
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
        availableTypes: {
          ar: ["عادي", "بالمكسرات"],
          en: ["Regular", "With Nuts"],
        },
        unit: { ar: "قطعة", en: "Piece" },
        image: mealImage,
        isPopular: true,
        preparationTime: { ar: "3 دقائق", en: "3 minutes" },
        tags: ["dessert", "chocolate", "sweet"],
      },
      {
        id: "tiramisu",
        name: { en: "Tiramisu", ar: "تيراميسو" },
        description: {
          en: "Classic Italian tiramisu with coffee and mascarpone",
          ar: "تيراميسو إيطالي كلاسيكي بالقهوة والماسكاربوني",
        },
        price: 25,
        currency: "SAR",
        category: "desserts",
        availableTypes: {
          ar: ["عادي", "بالشوكولاتة"],
          en: ["Regular", "With Chocolate"],
        },
        unit: { ar: "قطعة", en: "Piece" },
        image: mealImage,
        isPopular: true,
        preparationTime: { ar: "3 دقائق", en: "3 minutes" },
        tags: ["dessert", "italian", "coffee"],
      },
    ],
  },
  {
    id: 8,
    name: { en: "Family Meals", ar: "الوجبات العائلية" },
    icon: "fa fa-users",
    items: [
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
    ],
  },
];

export default function CashierOrders() {
  // Use the custom hook instead of manual localStorage management
  const [order, setOrder] = useLocalStorage("order", []);
  const [checkedOutOrder, setCheckedOutOrder] = useState([]);

  function addToOrder(item, quantity, selectedType) {
    setOrder((prevOrder) => [...prevOrder, { item, quantity, selectedType }]);
  }

  function removeFromOrder(itemId) {
    setOrder((prevOrder) =>
      prevOrder.filter((orderItem) => orderItem.item.id !== itemId)
    );
  }

  function updateQuantity(itemId, quantity) {
    setOrder((prevOrder) =>
      prevOrder.map((orderItem) =>
        orderItem.item.id === itemId ? { ...orderItem, quantity } : orderItem
      )
    );
  }

  function clearOrder() {
    setOrder([]);
  }

  function handleCheckout(paymentMethod = "نقدًا") {
    setCheckedOutOrder(order);
    localStorage.setItem("checkedOutOrder", JSON.stringify(order));
    printSaudiInvoice(order, paymentMethod);
    clearOrder();
  }

 function printSaudiInvoice(orderToPrint, paymentMethod = "بطاقة") {
   const vatRate = 0.15;
   const subtotal = orderToPrint.reduce(
     (sum, i) => sum + i.item.price * i.quantity,
     0
   );
   const vatAmount = subtotal * vatRate;
   const totalWithVat = subtotal + vatAmount;

   const now = new Date().toISOString();
   const invoiceNumber = Math.floor(1000 + Math.random() * 9000);
   const reference = Math.random().toString(36).substring(2, 7).toUpperCase();

   const companyName = "مطعم جيلي فِش";
   const vatNumber = "312258433900003";

   // ✅ توليد QR رسمي بصيغة TLV Base64
   function toTLV(tag, value) {
     const textEncoder = new TextEncoder();
     const valueBytes = textEncoder.encode(value);
     const length = valueBytes.length;
     return [tag, length, ...valueBytes];
   }

   const fields = [
     toTLV(1, companyName),
     toTLV(2, vatNumber),
     toTLV(3, now),
     toTLV(4, totalWithVat.toFixed(2)),
     toTLV(5, vatAmount.toFixed(2)),
   ];

   const qrUint8Array = new Uint8Array(fields.flat());
   const qrBase64 = btoa(String.fromCharCode(...qrUint8Array));

   const receiptWindow = window.open(
     "",
     "Print Receipt",
     "width=300,height=700"
   );

   receiptWindow.document.write(`
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>فاتورة ضريبية مبسطة</title>
      <style>
        body {
          font-family: "Cairo", sans-serif;
          width: 80mm;
          margin: 0 auto;
          padding: 5px;
          font-size: 13px;
          line-height: 1.4;
        }
        .center { text-align: center; }
        h1 { font-size: 16px; margin: 5px 0; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { padding: 4px 0; text-align: center; }
        th { border-bottom: 1px dashed #000; font-weight: bold; }
        .info, .footer { font-size: 12px; }
        .footer { text-align: center; margin-top: 10px; }
        .bold { font-weight: bold; }
        .qr { text-align: center; margin-top: 10px; }
        img.qr-img { width: 120px; height: 120px; }
      </style>
    </head>
    <body>
      <div class="center">
        <h1>${companyName}</h1>
        <div>Jelly Fish Restaurant</div>
        <div>الفرع الرئيسي</div>
        <div>الرياض - حي الشفا</div>
      </div>
      <hr />
      <div class="info">
        <div>فاتورة ضريبية مبسطة</div>
        <div>Simplified Tax Invoice</div>
        <hr />
        <div>الرقم المرجعي: ${reference}</div>
        <div>رقم الفاتورة: ${invoiceNumber}</div>
        <div>تاريخ الإصدار: ${new Date().toLocaleString("ar-SA")}</div>
        <div>الرقم الضريبي: ${vatNumber}</div>
        <div>السجل التجاري: 7008094489</div>
        <div>طريقة الدفع: ${paymentMethod}</div>
      </div>
      <hr />
      <table>
        <thead>
          <tr>
            <th>الصنف</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الضريبة</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${orderToPrint
            .map((item) => {
              const price = item.item.price * item.quantity;
              const vat = price * vatRate;
              const total = price + vat;
              return `
                <tr>
                  <td>${item.item.name.ar}<br>
                    ${
                      item.selectedType
                        ? `<small>${item.selectedType}</small>`
                        : ""
                    }
                  </td>
                  <td>${item.quantity}</td>
                  <td>${item.item.price.toFixed(2)}</td>
                  <td>${vat.toFixed(2)}</td>
                  <td>${total.toFixed(2)}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
      <hr />
      <div class="bold">الإجمالي (غير شامل الضريبة): ${subtotal.toFixed(
        2
      )} ر.س</div>
      <div>ضريبة القيمة المضافة (15%): ${vatAmount.toFixed(2)} ر.س</div>
      <div class="bold">الإجمالي شامل الضريبة: ${totalWithVat.toFixed(
        2
      )} ر.س</div>
      <hr />
      <div class="qr">
        <img src="https://api.qrserver.com/v1/create-qr-code/?data=${qrBase64}&size=150x150" class="qr-img" />
      </div>
      <div class="footer">
        شكرًا لتعاملكم معنا ❤️<br />
        تمت الطباعة بواسطة نظام Jelly Fish
      </div>
    </body>
  </html>
  `);

   receiptWindow.document.close();
   receiptWindow.print();
 }

  return (
    <div className="d-flex justify-content-end">
      <div className="menu ps-3 pt-3">
        <Menu menu={menu} addToOrder={addToOrder} />
      </div>
      <div className="chekout">
        <CheckOut
          order={order}
          removeFromOrder={removeFromOrder}
          updateQuantity={updateQuantity}
          handleCheckout={handleCheckout}
        />
      </div>
    </div>
  );
}
