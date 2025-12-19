import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalHeader from "@/components/ui/GlobalHeader";
import { MultiHospitalProvider } from "@/contexts/MultiHospitalContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hospital Management System",
  description: "Manage hospital appointments and patient records",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <GlobalHeader />
        <MultiHospitalProvider>
          {children}
        </MultiHospitalProvider>
      </body>
    </html>
  );
}
