import React from "react";
import { Outlet } from "react-router-dom";
import Aside from "./Aside";
export default function Cashier() {
  return (
    <>
      <div className="cashier">
          <div className="d-flex ">
            <Aside />
            <main className="py-1">
              <Outlet />
            </main>
          </div>
      </div>
    </>
  ); 
}
