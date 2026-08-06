import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "knightscomputer.club — nodo tecnoactivista",
  description:
    "Nodo underground: dona, desarrolla RXos y debate. Foro con registro. Estética 2000 / hacker.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://knightscomputer.club"
  ),
  openGraph: {
    title: "knightscomputer.club",
    description: "Tecnoactivismo · RXos · foro · donaciones",
    type: "website",
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
      </body>
    </html>
  );
}
