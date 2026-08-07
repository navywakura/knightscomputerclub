import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <span className="warn">[!] </span>
        knightscomputer.club — nodo independiente · no afiliado a gobiernos ni
        corporaciones
      </div>
      <div style={{ marginTop: 6 }}>
        RXos © comunidad · donaciones voluntarias ·{" "}
        <span className="blink">_</span>
      </div>
      <nav
        className="footer-seo-nav"
        aria-label="enlaces del sitio"
        style={{ marginTop: 8, opacity: 0.85 }}
      >
        <Link href="/">home</Link>
        {" · "}
        <Link href="/forum">foro</Link>
        {" · "}
        <Link href="/donate">donar</Link>
        {" · "}
        <Link href="/sitemap.xml">sitemap</Link>
      </nav>
      <div style={{ marginTop: 6, opacity: 0.7 }}>
        best viewed with a CRT, 800×600, and zero patience for surveillance
        capitalism
      </div>
    </footer>
  );
}
