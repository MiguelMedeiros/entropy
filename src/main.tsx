import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { GlossaryProvider } from "./components/glossary-term";
import "./index.css";

document.documentElement.classList.toggle(
  "dark",
  window.matchMedia("(prefers-color-scheme: dark)").matches,
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlossaryProvider delayDuration={180} skipDelayDuration={100}>
      <App />
    </GlossaryProvider>
  </StrictMode>,
);
