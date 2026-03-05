import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Optimize font loading
const inter = Inter({ 
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
  fallback: ["system-ui", "arial", "sans-serif"]
});

// Metadata for SEO and social sharing
export const metadata: Metadata = {
  title: {
    default: "Raise TON - Jackpot Game",
    template: "%s | Raise TON"
  },
  description: "Play jackpot games, win NFTs and TON tokens. Daily bonuses, referral rewards, and exciting NFT prizes!",
  keywords: ["TON", "jackpot", "NFT", "crypto game", "telegram game", "blockchain game"],
  authors: [{ name: "Raise TON Team" }],
  creator: "Raise TON",
  publisher: "Raise TON",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://raiseton.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Raise TON - Jackpot Game",
    description: "Play jackpot games, win NFTs and TON tokens",
    url: "https://raiseton.com",
    siteName: "Raise TON",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Raise TON - Jackpot Game",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Raise TON - Jackpot Game",
    description: "Play jackpot games, win NFTs and TON tokens",
    images: ["/twitter-image.png"],
    creator: "@raiseton",
    site: "@raiseton",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#2f7cf6",
      },
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Raise TON",
  },
  applicationName: "Raise TON",
  category: "game",
};

// Viewport configuration for mobile
export const viewport: Viewport = {
  themeColor: "#2f7cf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* PWA tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Preconnect to critical origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* DNS prefetch for API */}
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787"} />
      </head>
      <body>
        <div className="appShell">
          {children}
        </div>
        
        {/* Performance monitoring */}
        <Analytics />
        <SpeedInsights />
        
        {/* Service Worker registration for PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}