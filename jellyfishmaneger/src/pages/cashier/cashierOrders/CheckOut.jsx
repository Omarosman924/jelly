import { useTranslation } from "react-i18next";
import riyal from "../../../assets/Saudi_Riyal_Symbol.png";
import CheckOutItem from "./CheckOutItem";

export default function CheckOut({ order, removeFromOrder, updateQuantity, handleCheckout }) {
  const { t } = useTranslation();
  return (
    <>
      <h4 className="mb-3 w-100 align-self-start">{t("checkout")}</h4>
      <div className="d-flex flex-wrap checkoutInner ">
        <div className="w-100 align-self-start">
          {
            order?.map((item, index) => (
              <CheckOutItem key={index} item={item} removeFromOrder={removeFromOrder} updateQuantity={updateQuantity} />
            ))
          }
        </div>
        <div className="align-self-end w-100">
          <div className="order-summary mt-3 p-2 rounded">
            <div className="d-flex justify-content-between fw-bold">
              <span>{t("grandTotal")}:</span>
              <span>
                {order?.reduce((total, item) => total + item.item.price * item.quantity, 0)}
                <img
                  src={riyal}
                  alt="ر.س"
                  width={20}
                  height={20}
                  className="ms-1 align-middle"
                />
              </span>
            </div>
          </div>
          <div>
            <button className="btn btn-primary w-100 mt-3" onClick={handleCheckout}>
              {t("checkout")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
