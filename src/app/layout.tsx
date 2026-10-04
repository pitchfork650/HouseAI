import type { Metadata } from "next";
import { Geist, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-public-sans",
});
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "HouseAI Dental",
  description: "From X-ray to follow-up, one record.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} ${geist.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
