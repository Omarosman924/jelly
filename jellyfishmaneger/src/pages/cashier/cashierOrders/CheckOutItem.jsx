import React from "react";
import { useTranslation } from "react-i18next";
import riyal from "../../../assets/Saudi_Riyal_Symbol.png";
import QuantityControls from "./QuantityControls";

export default function CheckOutItem({
  item,
  removeFromOrder,
  updateQuantity,
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language || window.localStorage.i18next || "en";

  return (
    <>
      <div className="checkoutItem mb-2 d-flex justify-content-between position-relative">
        <div>
          <h6>{item.item.name[lang]}</h6>
          <span className="badge bg-primary">{item.selectedType}</span>
          <QuantityControls
            unit={item.item.unit}
            lang={lang}
            quantity={item.quantity}
            setQuantity={(quantity) => updateQuantity(item.item.id, quantity)}
          />
        </div>
        <div>
          {" "}
          <img
            src={item.item.image}
            alt={item.item.name[lang]}
            width={80}
          />{" "}
          <div>
            {item.item.price * item.quantity}{" "}
            <img
              src={riyal}
              alt="ر.س"
              width={20}
              height={20}
              className="ms-1 align-middle"
            />
          </div>
        </div>
        <div className="position-absolute top-0 end-0">
          <button
            className="btn-close "
            onClick={() => removeFromOrder(item.item.id)}
          ></button>{" "}
        </div>
      </div>
    </>
  );
}
