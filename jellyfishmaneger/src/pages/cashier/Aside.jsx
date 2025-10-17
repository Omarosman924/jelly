import React from "react";
import { FaCashRegister } from "react-icons/fa";
import { FaListCheck } from "react-icons/fa6";
import { NavLink } from "react-router-dom";

export default function Aside() {
  return (
    <aside className=" d-flex flex-column align-items-center  border-end">
      <ul className="list-unstyled w-100">
        <li className="d-flex justify-content-center">
          <NavLink  to="/cashier">
            <FaCashRegister />
          </NavLink>
        </li>
        <li className="d-flex justify-content-center">
          <NavLink to="/cashier/orders">
            <FaListCheck />
          </NavLink>
        </li>
      </ul>
    </aside>
  );
}
