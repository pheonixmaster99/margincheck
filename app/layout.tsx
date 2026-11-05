import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { MarginCheckDataProvider } from "@/components/margincheck-data-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarginCheck",
  description: "Track estimated and actual job profitability.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <MarginCheckDataProvider>{children}</MarginCheckDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
