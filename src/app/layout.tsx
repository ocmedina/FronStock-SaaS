import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppearanceProvider } from "@/contexts/AppearanceContext";
import { Toaster } from "@/components/ui/sonner";
import { SessionTimeout } from "@/components/auth/SessionTimeout";
import { PWARegister } from "@/components/PWARegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FrontStock - Gestión de Inventario",
  description: "Sistema de gestión de inventario y punto de venta SaaS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FrontStock",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <AppearanceProvider>
            <PWARegister />
            <SessionTimeout timeoutInMinutes={60} />
            {children}
            <Toaster />
          </AppearanceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
