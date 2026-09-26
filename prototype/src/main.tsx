import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/space-mono/400.css";
import "@mantine/core/styles.css";
import "./styles.css";

import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { prototypeTheme } from "./config/theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={prototypeTheme} defaultColorScheme="auto">
      <App />
    </MantineProvider>
  </StrictMode>,
);
