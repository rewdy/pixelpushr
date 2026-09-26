import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/space-mono/400.css";
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { theme } from "./config/theme";

const queryClient = new QueryClient();
const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(<QueryClientProvider client={queryClient}><MantineProvider theme={theme} defaultColorScheme="auto"><App /></MantineProvider></QueryClientProvider>);
