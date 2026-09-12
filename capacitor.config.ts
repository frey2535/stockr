import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.currentflowconsulting.stockr",
  appName: "Stockr",
  webDir: "native/www",
  server: {
    androidScheme: "https",
    url: process.env.STOCKR_NATIVE_URL || "https://stockr.currentflowconsulting.org",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#0d1117",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d1117",
    },
  },
};

export default config;
