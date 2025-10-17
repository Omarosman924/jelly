import React from 'react'

export default function MealTypeSelector({ types, isRtl, selectedType, setSelectedType }) {
  const lang = isRtl ? 'ar' : 'en';
  
  return (
    <>
      <div className="d-flex gap-2 flex-wrap MealTypeSelector">
        {types[lang].map((type) => (
          <div
            key={type}
            onClick={() => setSelectedType(type)}
            role="button"
            className={`badge ${
              type === selectedType ? "bg-primary" : "bg-secondary"
            }`}
          >
            {type}
          </div>
        ))}
      </div>
    </>
  );
}
