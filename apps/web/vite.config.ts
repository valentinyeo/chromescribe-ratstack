import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";

import { backendPlugin } from "./backend-plugin.js";
import { stylexPlugin } from "./stylex.js";

export default defineConfig({
  plugins: [
    stylexPlugin(),
    backendPlugin(),
    foldkit({
      ssr: {
        build: { prerender: true },
        clientEntry: "/src/client/entry.ts",
        serverEntry: "/src/entry.server.ts",
      },
    }),
  ],
});
