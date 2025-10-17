"use client";
import { useState } from "react";

const MealTypeSelector = ({ types, defaultSelected, itemId }) => {
  const [selectedType, setSelectedType] = useState(defaultSelected);

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    console.log(`Selected ${type} for item ${itemId}`);
  };

  return (
    <div className="mb-2" role="radiogroup" aria-label="اختيار طريقة التحضير">
      {types.map((type, index) => (
        <button
          key={type}
          type="button"
          role="radio"
          aria-checked={selectedType === type}
          className={`badge rounded-pill me-1 mealTypeBadge ${
            selectedType === type ? "active" : ""
          }`}
          onClick={() => handleTypeSelect(type)}
          aria-label={`اختيار ${type}`}
        >
          {type}
        </button>
      ))}
    </div>
  );
};

export default MealTypeSelector;
