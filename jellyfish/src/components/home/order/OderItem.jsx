import Image from "next/image";
import mealImage from "../../../../public/mael.jpg";
import riyal from "../../../../public/Saudi_Riyal_Symbol.png";
import { useTranslations } from "next-intl";

const OrderItem = ({ item }) => {
  const t = useTranslations();

  return (
    <>
      <div key={item.id} className="order-item mb-3 p-2 border rounded">
        <div className="item-header d-flex mb-2">
          <div className="item-info flex-grow-1 ms-2">
            <p className="mb-1 fw-semibold">{item.item_description}</p>
            <div className="d-flex justify-content-between align-items-center">
              <small className="text-muted">
                {item.unit_price}{" "}
                <Image
                  src={riyal}
                  alt="ر.س"
                  width={20}
                  height={20}
                  className="me-1"
                />
              </small>

              {/* Quantity controls */}
              <div className="quantity-controls d-flex align-items-center me-1">
                <button className="btn btn-sm btn-outline-secondary me-1">
                  -
                </button>
                <span className="mx-1">{item.quantity}</span>
                <button className="btn btn-sm btn-outline-secondary ms-1">
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="position-relative">
            <Image
              src={mealImage}
              alt={item.item_description}
              width={60}
              height={60}
              className="order-item-image rounded object-fit-cover"
              // onError={(e) => {
              //   e.target.src = "/images/default-meal.jpg";
              // }}
            />
            {/* Quantity badge */}
            <span className="position-absolute end-0 top-0  badge rounded-pill bg-primary orderItem-quantity-badge">
              {item.quantity}
            </span>
          </div>
        </div>

        {/* Price breakdown - collapsible */}
        <div className="collapse" id={`details-${item.id}`}>
          <div className="item-details">
            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted">{t("order.unitPrice")}:</span>
              <span>
                {item.unit_price}{" "}
                <Image
                  src={riyal}
                  alt="ر.س"
                  width={20}
                  height={20}
                  className="me-1"
                />
              </span>
            </div>

            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted">{t("order.vatRate")}:</span>
              <span>{item.vat_rate}%</span>
            </div>

            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted">{t("order.vatAmount")}:</span>
              <span>
                {item.vat_amount}{" "}
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
        </div>

        <div className="d-flex justify-content-between align-items-center">
          <button
            className="btn btn-link btn-sm p-0 text-decoration-none"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target={`#details-${item.id}`}
            aria-expanded="false"
            aria-controls={`details-${item.id}`}
          >
            {t("order.showDetails")}
          </button>
          <span className="fw-bold">
            {item.total_amount}{" "}
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
    </>
  );
};

export default OrderItem;
