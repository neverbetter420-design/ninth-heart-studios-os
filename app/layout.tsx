import type { Metadata } from "next";
import "./globals.css";
import "./phase2.css";
import "./phase3.css";
import "./phase4.css";
import "./phase7.css";

export const metadata: Metadata = {
  title: "Ninth Heart Studios OS",
  description: "The custom operating system for Ninth Heart Studios.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        {children}
      </body>
    </html>
  );
}
