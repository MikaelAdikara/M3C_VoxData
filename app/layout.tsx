import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import { NavLinks } from "@/components/shell/NavLinks";
import { themeBootScript } from "@/components/shell/ThemeToggle";
import { Footer, TopBar } from "@/components/shell/TopBar";
import { getShiftBoardView } from "@/lib/queries";

import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Learning Line",
  description: "Concept prototype with simulated data",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const board = await getShiftBoardView();

  return (
    <html lang="en" className={sourceSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <TopBar shiftLabel={board.shift.label} site="K2-Body · Karawang II" />
        {children}
        <Footer />
        <NavLinks variant="tabbar" />
        <Script src="https://unpkg.com/@phosphor-icons/web@2.1.1" strategy="afterInteractive" />
      </body>
    </html>
  );
}
