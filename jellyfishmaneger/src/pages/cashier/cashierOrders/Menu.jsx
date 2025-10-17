import { useTranslation } from "react-i18next";
import Categories from "./Categories";
import MenuItem from "./MenuItem";
import { useState } from "react";

export default function Menu({ menu, addToOrder }) {
  const { i18n } = useTranslation();
  const [items, setItems] = useState(menu[0].items);

  return (
    <>
      <Categories categories={menu} />
      <div className="container-fluid">
        <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap">
          {items.map((item, index) => {
            return <MenuItem item={item} key={index} addToOrder={addToOrder} />;
          })}
        </div>
      </div>
    </>
  );
}
