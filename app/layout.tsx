import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./styles/theme.css";
import { ThemeProvider } from "./components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_COMPANY_NAME || "Handyman Quote Generator",
  description: "Quick, professional quotes for your project",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider />
        <div className="min-h-screen bg-themeBg">
          {children}
        </div>
      </body>
    </html>
  );
}
