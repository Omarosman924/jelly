import { Route, Routes } from "react-router-dom";
import Admin from "./pages/admin/Admin";
import Cashier from "./pages/cashier/Cashier";
import Kitchen from "./pages/kitchen/Kitchen";
import Product from "./pages/admin/Product";
import HallManager from "./pages/HallManager/HallManager";
import Login from "./pages/registration/Login";
import Register from "./pages/registration/Register";
import Error404 from "./pages/Error404";
import Navbar from "./components/layout/Navbar";
import Profile from "./pages/Profile/Profile";
import LoadingWrapper from "./components/ui/LoadingWrapper";
import CashierOrders from "./pages/cashier/cashierOrders/CashierOrders";
import Orders from "./pages/cashier/Orders";
import "./App.css";

export default function App() {
  return (
    <div>
      <LoadingWrapper>
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Admin />}>
            <Route path="product/:id" element={<Product />} />
          </Route>
          <Route path="/kitchen" element={<Kitchen />}></Route>
          <Route path="/cashier" element={<Cashier />}>
            <Route index element={<CashierOrders />} />
            <Route path="orders" element={<Orders />} />
          </Route>
          <Route path="/hallmanager" element={<HallManager />}></Route>
          <Route path="/profile" element={<Profile />}></Route>
          <Route path="*" element={<Error404 />} />
        </Routes>
      </LoadingWrapper>
    </div>
  );
}
