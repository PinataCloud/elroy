import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected, metaMask, safe } from "wagmi/connectors";
import { farcasterFrame as miniAppConnector } from "@farcaster/frame-wagmi-connector";

export const config = createConfig({
  chains: [base],
  connectors: [injected(), metaMask(), safe(), miniAppConnector()],
  transports: {
    [base.id]: http(
      "https://base-mainnet.g.alchemy.com/v2/hNh344Z1xgLJaVEu84EBXbvX9ow36Q2e",
    ),
  },
});

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
