"use client";
import { useState } from "react";

const AddToOrderButton = ({ itemId, itemName, price, currency }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  const handleAddToOrder = async () => {
    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setIsAdded(true);
      setTimeout(() => setIsAdded(false), 2000);
    } catch (error) {
      console.error("خطأ في إضافة المنتج:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={`btn w-100 ${isAdded ? "btn-success" : "btn-secondary"}`}
      onClick={handleAddToOrder}
      disabled={isLoading || isAdded}
      aria-label={`إضافة ${itemName} إلى الطلب بسعر ${price} ${currency}`}
      type="button"
    >
      {isLoading
        ? "جاري الإضافة..."
        : isAdded
        ? "تم الإضافة ✓"
        : "أضف إلى الطلب"}
    </button>
  );
};

export default AddToOrderButton;
