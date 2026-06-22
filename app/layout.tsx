import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./styles/theme.css";
import { ThemeProvider } from "./components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_COMPANY_NAME || "Handyman Quote Generator",
  description: "Quick, professional quotes for your project",
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "H&H Admin",
  },
  icons: {
    // Resolved dynamically (see app/api/app-icon) so the favicon / home-screen
    // icon follows the admin-configured app icon without a redeploy.
    icon: [{ url: "/api/app-icon" }],
    apple: [{ url: "/api/app-icon" }],
  },
};

export const viewport = {
  themeColor: "#78350f",
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
