import Link from "next/link";
import Panel from "@/components/Panel";
import CopyButton from "@/components/CopyButton";
import { getDonationChannels } from "@/lib/donations";

export const metadata = {
  title: "donar — knightscomputer.club",
  description: "Canales de donación: PayPal, Ko-fi, Bitcoin, Solana, USDT",
};

export default function DonatePage() {
  const channels = getDonationChannels();

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
          en el foro: handle en oro eléctrico. Tras donar, avisá en{" "}
          <Link href="/forum/ops">// ops-infra</Link> con tu username +
          comprobante (tx / captura).
        </p>
        <div className="btn-row">
          <Link href="/forum/ops" className="btn secondary">
            [ debatir uso de fondos → // ops-infra ]
          </Link>
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
