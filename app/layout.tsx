import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";

import { ChromeGate } from "@/components/shell/ChromeGate";
import { NavLinks } from "@/components/shell/NavLinks";
import { themeBootScript } from "@/components/shell/ThemeToggle";
import { Footer, TopBar } from "@/components/shell/TopBar";
import { getCurrentRole, getShiftBoardView } from "@/lib/queries";

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
  const [role, board] = await Promise.all([getCurrentRole(), getShiftBoardView()]);

  return (
    <html lang="en" className={sourceSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ChromeGate>
          <TopBar role={role} shiftLabel={board.shift.label} site="K2-Body · Karawang II" />
        </ChromeGate>
        {children}
        <ChromeGate>
          <Footer />
          <NavLinks variant="tabbar" />
        </ChromeGate>
      </body>
    </html>
  );
}
