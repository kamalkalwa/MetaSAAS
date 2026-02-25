import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

/**
 * Viewport configuration for PWA.
 * Exported separately per Next.js 15 requirements.
 */
export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "MetaSAAS",
  description: "AI-native, entity-driven SaaS application",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MetaSAAS",
  },
  formatDetection: {
    telephone: false,
  },
};

/**
 * Root layout — wraps the entire application.
 * Provides the HTML shell, global styles, and context providers.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA: theme color for browser chrome */}
        <meta name="theme-color" content="#4f46e5" />
        {/* PWA: apple touch icon */}
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        {/*
          Theme restoration — runs before first paint to prevent flash.
          Must be in <head> so it executes before the browser renders <body>.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var t = localStorage.getItem('metasaas:theme');
                  if (t === 'dark') document.documentElement.classList.add('dark');
                  if (t === 'light') document.documentElement.classList.add('light');
                } catch(e){}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        {/* PWA: register service worker for offline support */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
