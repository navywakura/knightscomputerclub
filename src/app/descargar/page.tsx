import type { Metadata } from "next";
import Link from "next/link";
import Panel from "@/components/Panel";
import PlatformLogo from "@/components/PlatformLogo";
import { DOWNLOAD_PLATFORMS } from "@/lib/downloads";

export const metadata: Metadata = {
  title: "descargar",
  description:
    "Descargá KCC Nexo: Windows Electron listo. macOS, Linux, CLI, Android e iOS en camino.",
  alternates: { canonical: "/descargar" },
  openGraph: {
    title: "Descargar · knightscomputer.club",
    description:
      "Clientes del nodo: escritorio, móvil y CLI. Windows disponible ahora.",
    url: "/descargar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Descargar · knightscomputer.club",
    description: "KCC Nexo para Windows y más plataformas.",
  },
};

export default function DescargarPage() {
  return (
    <>
      <Panel title="~/download · get_client.sh">
        <h1 className="glow">DESCARGAR CLIENTES</h1>
        <p>
          Elegí la plataforma. La app de escritorio{" "}
          <strong>KCC Nexo</strong> conecta a{" "}
          <Link href="/nexo">// nexo</Link> en el sitio (UI siempre
          actualizada). Otras plataformas: próximamente.
        </p>
        <p className="muted">
          También podés usar nexo en el navegador sin instalar nada →{" "}
          <Link href="/nexo">abrir // nexo</Link>
        </p>
      </Panel>

      <div className="download-grid">
        {DOWNLOAD_PLATFORMS.map((p) => {
          const ready = p.status === "ready";
          return (
            <article
              key={p.id}
              className={`download-card${ready ? " ready" : " soon"}`}
            >
              <div className="download-card-top">
                <div className="download-card-logo" data-platform={p.logo}>
                  <PlatformLogo platform={p.logo} size={40} />
                </div>
                <div className="download-card-body">
                  <header className="download-card-head">
                    <h2>{p.name}</h2>
                    {ready ? (
                      <span className="tag ok">disponible</span>
                    ) : (
                      <span className="tag">próximamente</span>
                    )}
                  </header>
                  <p className="download-card-sub muted">{p.subtitle}</p>
                  {p.version ? (
                    <p className="muted" style={{ fontSize: "0.8rem" }}>
                      versión {p.version}
                    </p>
                  ) : null}
                </div>
              </div>
              {p.notes ? (
                <p className="download-card-notes">{p.notes}</p>
              ) : null}
              <div className="download-card-actions">
                {ready && p.href ? (
                  <>
                    <a
                      className="btn"
                      href={p.href}
                      download
                      rel="noopener noreferrer"
                    >
                      {p.cta || "[ descargar ]"}
                    </a>
                    {p.alt?.map((a) => (
                      <a
                        key={a.href}
                        className="btn secondary"
                        href={a.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {a.label}
                      </a>
                    ))}
                  </>
                ) : (
                  <button type="button" className="btn secondary" disabled>
                    [ aún no disponible ]
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Panel title="notas">
        <ul className="bullet-list">
          <li>
            <strong>Windows</strong>: instalador NSIS o portable. Requiere
            Windows 10+ x64.
          </li>
          <li>
            Auto-update del shell vía GitHub Releases; la UI web se refresca
            sola.
          </li>
          <li>
            Fuentes / releases:{" "}
            <a
              href="https://github.com/navywakura/knightscomputerclub/releases"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/navywakura/knightscomputerclub/releases
            </a>
          </li>
          <li>
            ¿Solo web? No hace falta descargar →{" "}
            <Link href="/nexo">// nexo</Link> ·{" "}
            <Link href="/forum">// forum</Link>
          </li>
        </ul>
      </Panel>
    </>
  );
}
