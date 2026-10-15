import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { AppShell } from "./app-shell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Work Management",
  description: "Employee task management",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-preference" strategy="beforeInteractive">{`try { const saved = localStorage.getItem("theme"); const theme = saved === "light" || saved === "dark" ? saved : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.dataset.theme = theme; } catch {}`}</Script>
      </head>
      <body className={inter.variable}><a className="skip-link" href="#main-content">Skip to content</a><AppShell>{children}</AppShell></body>
    </html>
  );
}
