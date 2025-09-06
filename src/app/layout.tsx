import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { ThemeScript } from "@/features/theme/utils/script";
import { Providers } from "@/provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BizBot — Chat with Data · Nigerian Businesses · Productivity Tool",
  description:
    "BizBot helps teams and individuals chat with data, explore Nigerian businesses, and get step-by-step guidance on setting one up. Improve productivity with an intuitive interface.",
  icons: {
    icon: [
      {
        url: "/favicon_io/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/favicon_io/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/favicon_io/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/favicon_io/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: "/favicon_io/apple-touch-icon.png",
  },
  manifest: "/favicon_io/site.webmanifest",
  openGraph: {
    title: "BizBot — Chat with Data · Nigerian Businesses · Productivity Tool",
    type: "website",
    url: "https://1732-chat-ml.netlify.app",
    description:
      "BizBot helps teams and individuals chat with data, explore Nigerian businesses, and learn how to start one. Boost productivity through an intuitive chat-based interface.",
    images: [
      {
        url: "https://cdn.sanity.io/media-libraries/mlu3DBU0QaKb/images/4df501056db70693bf909e15fb4e0d44f1fda033-5760x3240.png",
        width: 1200,
        height: 630,
        alt: "BizBot — Chat with Data and Explore Nigerian Businesses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BizBot — Chat with Data · Nigerian Businesses · Productivity Tool",
    description:
      "Chat with data, explore Nigerian businesses, and learn how to set one up — with BizBot’s intuitive interface.",
    images: [
      "https://cdn.sanity.io/media-libraries/mlu3DBU0QaKb/images/4df501056db70693bf909e15fb4e0d44f1fda033-5760x3240.png",
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-mono antialiased`}
      >
        <Providers>{children}</Providers>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
