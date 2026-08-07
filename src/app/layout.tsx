import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AmbientMusicPlayer from "@/components/AmbientMusicPlayer";
import "./globals.css";
import "../../packages/web-notify/src/react/styles.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://knightscomputer.club";

const title = "knightscomputer.club — nodo tecnoactivista";
const description =
  "Nodo underground: dona, desarrolla RXos y debate. Foro con registro. Estética 2000 / hacker.";

export const metadata: Metadata = {
  title: {
    default: title,
    template: "%s · knightscomputer.club",
  },
  description,
  applicationName: "knightscomputer.club",
  metadataBase: new URL(siteUrl),
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
    description: "Tecnoactivismo · RXos · foro · donaciones",
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
    description: "Tecnoactivismo · RXos · foro · donaciones",
    images: ["/og-image.jpg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <div className="shell">
          <Header />
          <main>{children}</main>
          <Footer />
        </div>
        <AmbientMusicPlayer />
      </body>
    </html>
  );
}
