import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "@fortawesome/fontawesome-free/css/all.min.css"
import { loadBootstrapCSS } from "./utils/loadBootstrap";
import "bootstrap/dist/js/bootstrap.bundle.min.js"; 
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";

    loadBootstrapCSS(true);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <App />
    </BrowserRouter>
  </StrictMode>
);
