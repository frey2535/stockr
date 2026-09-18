"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { UpdateAvailablePrompt } from "@/components/update-available-prompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <UpdateAvailablePrompt />
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}
