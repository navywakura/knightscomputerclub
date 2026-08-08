import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AmbientMusicPlayer from "@/components/AmbientMusicPlayer";
import GlobalNotifyToast from "@/components/GlobalNotifyToast";
import JsonLd, { siteJsonLd } from "@/components/JsonLd";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";
import "../../packages/web-notify/src/react/styles.css";

const siteUrl = getSiteUrl();

const title = "knightscomputer.club — nodo tecnoactivista";
const description =
  "Nodo underground de computación libre: foro, donaciones y desarrollo de RXos. Tecnoactivismo, open hardware y debate sin algoritmos.";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050805" },
    { media: "(prefers-color-scheme: light)", color: "#050805" },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: title,
    template: "%s · knightscomputer.club",
  },
  description,
  applicationName: "knightscomputer.club",
  metadataBase: new URL(siteUrl),
  keywords: [
    "knightscomputer",
    "RXos",
    "tecnoactivismo",
    "open hardware",
    "foro",
    "software libre",
    "donaciones crypto",
    "underground",
    "computación libre",
  ],
  authors: [{ name: "Knights Labs", url: siteUrl }],
  creator: "Knights Labs",
  publisher: "knightscomputer.club",
  category: "technology",
  alternates: {
    canonical: "/",
    languages: {
      "es-ES": "/",
      es: "/",
    },
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/knightslabs_logo.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon-32.png"],
  },
  openGraph: {
    title: "knightscomputer.club",
    description:
      "Tecnoactivismo · RXos · foro · donaciones. Nodo underground de computación libre.",
    type: "website",
    locale: "es_ES",
    siteName: "knightscomputer.club",
    url: siteUrl,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 1200,
        alt: "knightscomputer.club — Knights Labs",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "knightscomputer.club",
    description:
      "Tecnoactivismo · RXos · foro · donaciones. Nodo underground de computación libre.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <JsonLd data={siteJsonLd()} />
        <div className="shell">
          <Header />
          <main>{children}</main>
          <Footer />
        </div>
        <GlobalNotifyToast />
        <AmbientMusicPlayer />
      </body>
    </html>
  );
}
