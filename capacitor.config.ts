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
      backgroundColor: "#f3f5f8",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#1e40af",
    },
  },
};

export default config;
