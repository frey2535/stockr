import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const appBuildId = new Date().toISOString()

function appVersionPlugin(id) {
  return {
    name: "app-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ build: id }),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_BUILD": JSON.stringify(appBuildId),
  },
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    appVersionPlugin(appBuildId),
  ]
});