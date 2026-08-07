import type { Metadata } from "next";
import Link from "next/link";
import Panel from "@/components/Panel";
import CopyButton from "@/components/CopyButton";
import { getDonationChannels } from "@/lib/donations";
import { FORUM_THEMES, VIP_PERKS } from "@/lib/forum-themes";

export const metadata: Metadata = {
  title: "donar",
  description:
    "Apoyá el nodo y RXos: PayPal, Ko-fi, Bitcoin, Solana y USDT. Donantes verificados reciben rango VIP: badge, temas del foro y más.",
  alternates: { canonical: "/donate" },
  openGraph: {
    title: "Donar · knightscomputer.club",
    description:
      "Canales de donación fiat y crypto. VIP: temas del foro, badge oro y reconocimiento.",
    url: "/donate",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Donar · knightscomputer.club",
    description: "PayPal, Ko-fi, BTC, SOL, USDT — financiá el nodo · perk VIP.",
  },
  keywords: [
    "donar",
    "bitcoin",
    "solana",
    "usdt",
    "paypal",
    "ko-fi",
    "RXos",
    "VIP",
    "knightscomputer",
  ],
};

export default function DonatePage() {
  const channels = getDonationChannels();
  const themeSkins = FORUM_THEMES.filter((t) => t.id !== "default");

  return (
    <>
      <Panel title="~/donate · funding.sh">
        <h1 className="glow">CANALES DE DONACIÓN</h1>
        <p>
          El nodo corre con voluntariado y hardware prestado. Si podés
          aportar — fiat o crypto — mantenés vivo el desarrollo de{" "}
          <strong>RXos</strong> y la infraestructura del club.
        </p>
        <p>
          Donantes verificados reciben el rango{" "}
          <span className="vip-badge" data-text="[VIP]">
            [VIP]
          </span>{" "}
          en el foro: handle en oro eléctrico + perks (abajo). Tras donar,
          avisá en <Link href="/forum/ops">// ops-infra</Link> con tu username +
          comprobante (tx / captura).
        </p>
        <div className="btn-row">
          <Link href="/forum/ops" className="btn secondary">
            [ debatir uso de fondos → // ops-infra ]
          </Link>
        </div>
      </Panel>

      <Panel title="~/donate · vip.perks">
        <h2>
          rango{" "}
          <span className="vip-badge" data-text="[VIP]">
            [VIP]
          </span>{" "}
          — ventajas
        </h2>
        <p className="muted">
          No es pay-to-win del kernel. Es cosmética, reconocimiento y skins del
          foro. El código sigue libre.
        </p>
        <ul className="vip-perks-list">
          {VIP_PERKS.map((p) => (
            <li key={p.title} className="vip-perk">
              <strong>{p.title}</strong>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>

        <h3 style={{ marginTop: 16, marginBottom: 6 }}>
          skins del foro (VIP)
        </h3>
        <p className="muted" style={{ marginTop: 0 }}>
          En <Link href="/forum">/forum</Link> → botón{" "}
          <code>theme</code> (solo VIP / owner):
        </p>
        <div className="vip-theme-previews">
          {themeSkins.map((t) => (
            <div key={t.id} className="vip-theme-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.thumb || ""} alt={t.label} loading="lazy" />
              <span>
                {t.label} · {t.accent}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="donate-grid">
        {channels.map((ch) => (
          <div key={ch.id} className={`donate-card donate-${ch.id}`}>
            <div className="donate-icon-wrap" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="donate-icon"
                src={ch.icon}
                alt=""
                width={48}
                height={48}
                loading="lazy"
                decoding="async"
              />
            </div>
            <h3>{ch.label}</h3>
            <p className="muted" style={{ marginBottom: 8 }}>
              {ch.hint}
            </p>
            {ch.kind === "link" ? (
              <a
                href={ch.value}
                className="btn block"
                target="_blank"
                rel="noopener noreferrer"
              >
                abrir {ch.label} ↗
              </a>
            ) : (
              <>
                <div className="address-box" title="dirección">
                  {ch.value}
                </div>
                <CopyButton text={ch.value} />
              </>
            )}
          </div>
        ))}
      </div>

      <Panel title="~/donate · transparency.txt">
        <h2>transparencia</h2>
        <p>
          Preferimos donaciones sin intermediarios de vigilancia. Crypto
          on-chain es verificable. PayPal/Ko-fi son para quien no quiera
          lidiar con wallets.
        </p>
        <ul style={{ color: "var(--text-dim)", paddingLeft: "1.2em" }}>
          <li>toolchains, VMs, boards de prueba</li>
          <li>dominio + hosting del nodo (Vercel/Neon free tiers primero)</li>
          <li>documentación y builds públicos de RXos</li>
        </ul>
        <p className="muted">
          No vendemos datos. No hay «sponsor tier» con privilegios en el
          kernel. El código manda.
        </p>
      </Panel>
    </>
  );
}
