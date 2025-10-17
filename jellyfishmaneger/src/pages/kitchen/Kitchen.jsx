import React from "react";
import { Outlet } from "react-router-dom";

export default function Kitchen() {
  return (
    <>
      <div>Kitchen</div>
      <Outlet />
    </>
  );
}
