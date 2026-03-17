import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ComparePage } from "./ComparePage";

const path = window.location.pathname.replace(/\/+$/, "");

const Root = path === "/compare" ? ComparePage : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
