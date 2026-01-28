import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { SessionTimeout } from "@/components/auth/SessionTimeout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FrontStock - Gestión de Inventario",
  description: "Sistema de gestión de inventario y punto de venta SaaS",
  icons: {
    icon: "/logo.png",
  },
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
          <SessionTimeout timeoutInMinutes={60} />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
