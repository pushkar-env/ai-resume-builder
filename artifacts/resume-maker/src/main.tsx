import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

if (import.meta.env.VITE_API_URL) {
  const url = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "");
  setBaseUrl(url);
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
