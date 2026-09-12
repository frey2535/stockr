import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SITE_HOST, SITE_URL } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Stockr — Field inventory for contractors",
  description:
    "Multi-tenant inventory for warehouses and service fleets. Scan barcodes, transfer stock to trucks, receive purchase orders, and invite your crew.",
  applicationName: "Stockr",
  alternates: { canonical: "/" },
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Stockr",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Stockr",
    title: "Stockr — Field inventory for contractors",
    description:
      "Company workspaces for warehouses and service fleets. Scan, transfer, and receive material.",
  },
  other: {
    "stockr:host": SITE_HOST,
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
