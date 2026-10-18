import type { Metadata } from "next";
import { Cinzel, DM_Sans } from "next/font/google";
import "./globals.css";
import "./phase2.css";
import "./phase3.css";
import "./phase4.css";
import "./phase7.css";
import "./scanner.css";
import "./navigation.css";
import "./nocturne.css";
import "./nocturne-phase3.css";
import "./nocturne-command.css";
import "./atelier-studio.css";
import "./nocturne-leads.css";
import "./nocturne-management.css";
import "./nocturne-documents.css";
import "./nocturne-studio.css";

const headingFont = Cinzel({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-cinzel", display: "swap" });
const bodyFont = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Ninth Heart Studios OS",
  description: "The custom operating system for Ninth Heart Studios.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        {children}
      </body>
    </html>
  );
}
