import type { Metadata } from "next";
import { Figtree, Instrument_Serif, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });
const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lingua — AI Translation",
  description:
    "Translate text and documents into multiple languages using AI. Supports TXT, DOC, DOCX, PDF, XLSX, HTML, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        figtree.variable,
        instrumentSerif.variable,
        geistMono.variable
      )}
    >
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
