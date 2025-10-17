import React from "react";
import { NavLink } from "react-router-dom";

export default function CategoryItem({ category, isRTL }) {
  return (
    <>
      <NavLink
        key={category.id}
        className="category-item me-3 pb-3 card text-center text-decoration-none "
        to={`${category.name.en.toLowerCase()}`}
      >
        <div className="">
          <div className="mb-2 pt-3 ">
            <i className={`fa-xl  ${category.icon}`}></i>
          </div>
          {isRTL ? (
            <span className="">{category.name.ar}</span>
          ) : (
            <span className="">{category.name.en}</span>
          )}
        </div>
      </NavLink>
    </>
  );
}
