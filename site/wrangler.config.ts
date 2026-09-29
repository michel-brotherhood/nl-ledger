import { defineWranglerConfig } from "wrangler/experimental-config";

// Build settings for cf deploy, which hands the build to Wrangler.
export default defineWranglerConfig({
  build: { command: "node build.mjs && ./check.sh" },
  assetsDirectory: "dist",
});
