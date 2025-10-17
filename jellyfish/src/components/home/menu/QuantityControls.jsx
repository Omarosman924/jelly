"use client";
import { useState } from "react";

const QuantityControls = ({
  unit,
  itemId,
  min = 1,
  max = 10,
  defaultValue = 1,
}) => {
  const [quantity, setQuantity] = useState(defaultValue);

  const handleDecrease = () => {
    if (quantity > min) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleIncrease = () => {
    if (quantity < max) {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleInputChange = (e) => {
    const value = parseInt(e.target.value);
    if (value >= min && value <= max) {
      setQuantity(value);
    }
  };

  return (
    <div
      className="quantity-controls"
      role="group"
      aria-label="التحكم في الكمية"
    >
      <button
        className="quantity-btn text-white"
        onClick={handleDecrease}
        disabled={quantity <= min}
        aria-label="تقليل الكمية"
        type="button"
      >
        -
      </button>

      <input
        type="number"
        className="quantity-input"
        value={quantity}
        onChange={handleInputChange}
        min={min}
        max={max}
        aria-label={`الكمية بـ ${unit}`}
      />

      <button
        className="quantity-btn text-white"
        onClick={handleIncrease}
        disabled={quantity >= max}
        aria-label="زيادة الكمية"
        type="button"
      >
        +
      </button>

      <span style={{ marginRight: "10px", fontSize: "12px" }}>{unit}</span>
    </div>
  );
};

export default QuantityControls;
