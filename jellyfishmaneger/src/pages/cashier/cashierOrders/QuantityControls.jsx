import React, { useState } from 'react'

export default function QuantityControls({ unit, lang, quantity, setQuantity }) {

  return (
    <div className="quantity-controls">
      <button className="quantity-btn" onClick={() => setQuantity(quantity - 1)}>-</button>
      <input type="number" className="quantity-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      <button className="quantity-btn" onClick={() => setQuantity(quantity + 1)}>+</button>
      <span style={{ fontSize: "12px" }}> {unit[lang]} </span>
    </div>
  );
}
