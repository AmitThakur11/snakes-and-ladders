import type { Metadata } from "next";
import { Orbitron, Sora, Geist_Mono } from "next/font/google";
import "./globals.css";
import SpaceBackdrop from "@/components/SpaceBackdrop";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Snakes & Ladders",
  description: "Play Snakes and Ladders with friends or the computer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${orbitron.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col text-slate-100">
        <SpaceBackdrop />
        {children}
      </body>
    </html>
  );
}
