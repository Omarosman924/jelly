import { useTranslations } from "next-intl";
import OrderItem from "./OderItem";
import Image from "next/image";
import riyal from "../../../../public/Saudi_Riyal_Symbol.png";

const orderItems = [
  {
    id: 1,
    item_description: " كبسة مع المقبلات",
    image_url: "https://watanalghad.com/user_images/news/20-03-23-31069527.jpg",
    quantity: 1,
    unit_price: 65.0,
    vat_rate: 15.0,
    vat_amount: 9.75,
    total_amount: 74.75,
  },
  {
    id: 2,
    item_description: "شاورما دجاج مع البطاطس",
    image_url: "https://example.com/images/shawarma.jpg",
    quantity: 2,
    unit_price: 25.0,
    vat_rate: 15.0,
    vat_amount: 7.5,
    total_amount: 57.5,
  },
  {
    id: 3,  
    item_description: "سلطة فتوش كبيرة",
    image_url: "https://example.com/images/fattoush.jpg",
    quantity: 1,
    unit_price: 18.0,
    vat_rate: 15.0,
    vat_amount: 2.7,
    total_amount: 20.7,
  },
  {
    id: 4,
    item_description: "عصير برتقال طازج",
    image_url: "https://example.com/images/orange_juice.jpg",
    quantity: 3,
    unit_price: 12.0,
    vat_rate: 15.0,
    vat_amount: 5.4,
    total_amount: 41.4,
  },
  {
    id: 5,
    item_description: "مندي لحم مع الأرز",
    image_url: "https://example.com/images/mandi.jpg",
    quantity: 1,
    unit_price: 85.0,
    vat_rate: 15.0,
    vat_amount: 12.75,
    total_amount: 97.75,
  },
  //   {
  //     id: 6,
  //     item_description: "حمص بالطحينة",
  //     image_url: "https://example.com/images/hummus.jpg",
  //     quantity: 2,
  //     unit_price: 15.0,
  //     vat_rate: 15.0,
  //     vat_amount: 4.5,
  //     total_amount: 34.5,
  //   },
  //   {
  //     id: 7,
  //     item_description: "قهوة عربية",
  //     image_url: "https://example.com/images/arabic_coffee.jpg",
  //     quantity: 4,
  //     unit_price: 8.0,
  //     vat_rate: 15.0,
  //     vat_amount: 4.8,
  //     total_amount: 36.8,
  //   },
  //   {
  //     id: 8,
  //     item_description: "كنافة بالجبن",
  //     image_url: "https://example.com/images/knafeh.jpg",
  //     quantity: 1,
  //     unit_price: 32.0,
  //     vat_rate: 15.0,
  //     vat_amount: 4.8,
  //     total_amount: 36.8,
  //   },
  //   {
  //     id: 9,
  //     item_description: "فلافل مع الخبز",
  //     image_url: "https://example.com/images/falafel.jpg",
  //     quantity: 3,
  //     unit_price: 10.0,
  //     vat_rate: 15.0,
  //     vat_amount: 4.5,
  //     total_amount: 34.5,
  //   },
  //   {
  //     id: 10,
  //     item_description: "شاي أحمر مغربي",
  //     image_url: "https://example.com/images/moroccan_tea.jpg",
  //     quantity: 2,
  //     unit_price: 6.0,
  //     vat_rate: 15.0,
  //     vat_amount: 1.8,
  //     total_amount: 13.8,
  //   },
];

export default function OrderMenu() {
  const t = useTranslations();
  return (
    <>
      <h3>{t("aside.orderMenu")}</h3>

      <div className="order-items">
        {orderItems.map((item) => (
          <OrderItem key={item.id} item={item} />
        ))}
      </div>

      {/* Order Summary */}
      <div className="order-summary mt-3 p-2 rounded">
        <div className="d-flex justify-content-between fw-bold">
          <span>{t("order.grandTotal")}:</span>
          <span>
            {orderItems.reduce((sum, item) => sum + item.total_amount, 0)}{" "}
            <Image
              src={riyal}
              alt="ر.س"
              width={20}
              height={20}
              className="me-1"
            />
          </span>
        </div>
      </div>
      <div>
        <button className="btn btn-primary w-100 mt-3">
          {t("order.checkout")}
        </button>
      </div>
    </>
  );
}
