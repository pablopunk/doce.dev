// @ts-check
import { fileURLToPath, URL } from "node:url";
// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import { loadEnv } from "vite";

import node from "@astrojs/node";
import react from "@astrojs/react";

const { SITE_URL, APP_ENV } = loadEnv(
  process.env.NODE_ENV || "development",
  process.cwd(),
  "",
);

// Prefer site metadata from src/site.json, with env override
import site from "./src/site.json" assert { type: "json" };

// https://astro.build/config
export default defineConfig({
  site: SITE_URL || site.url,

  integrations: [sitemap({
    changefreq: "monthly",
    priority: 0.7,
    lastmod: new Date(),
  }), robotsTxt({
    policy:
      APP_ENV === "production"
        ? [{ userAgent: "*", allow: "/" }]
        : [{ userAgent: "*", disallow: "/" }],
  }), react()],

  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [tailwindcss()],
  },

  adapter: node({
    mode: "standalone",
  }),
});
