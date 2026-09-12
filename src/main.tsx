import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import "./styles.css";
import "./premium.css";
import "./scopes.css";
import "./student-tabs.css";
import "./ui-polish.css";
import "./redemption-page-fix.css";
import "./sidebar-fixed.css";
import "./sidebar-no-scroll.css";
import "./behavioral-cycle-admin-fix.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
