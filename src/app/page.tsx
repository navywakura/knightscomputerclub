import type { Metadata } from "next";
import Link from "next/link";
import Panel from "@/components/Panel";

export const metadata: Metadata = {
  title: {
    absolute: "knightscomputer.club — nodo tecnoactivista",
  },
  description:
    "Lobby del nodo: computación libre, RXos, foro y donaciones. Tecnoactivismo sin vigilancia.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "knightscomputer.club — lobby",
    description:
      "Nodo underground: doná, debaté y desarrollá RXos. Bienvenido al lobby.",
    url: "/",
    type: "website",
  },
};

const ASCII = `
 ██╗  ██╗ ██████╗
 ██║ ██╔╝██╔════╝
 █████╔╝ ██║     
 ██╔═██╗ ██║     
 ██║  ██╗╚██████╗
 ╚═╝  ╚═╝ ╚═════╝
 knightscomputer.club // underground node
`;

export default function HomePage() {
  return (
    <div className="lobby-home">
      <div className="lobby-marquee" aria-hidden>
        <span>
          ★ PLEASE HOLD ★ ELEVATOR MUSIC ★ GROUND FLOOR · FORUM · DONATE ★
          WELCOME TO THE LOBBY ★ NON-COPYRIGHT JAZZ ★
        </span>
      </div>

      <Panel title="lobby · ground floor">
        <pre className="ascii lobby-ascii">{ASCII}</pre>
        <h1 className="lobby-title">WELCOME TO THE LOBBY</h1>
        <p className="lobby-sub">
          knightscomputer.club · sala de espera del nodo
        </p>
        <p className="prompt lobby-prompt">
          <span className="cmd">desk@lobby:~$</span> soft jazz · soft light · no
          surveillance ads
          <span className="cursor" />
        </p>
        <p>
          Somos un <strong>nodo tecnoactivista</strong>: computación libre,
          hardware sin cadenas, software que no te vigila. Aquí se dona al
          desarrollo de <strong>RXos</strong>, se escribe código, y se debate
          sin algoritmo que te empuje al odio.
        </p>
        <p className="muted">
          ambientación elevador / waiting room · al entrar al foro o donate el
          tono vuelve al terminal verde
        </p>
        <div className="btn-row">
          <Link href="/donate" className="btn amber">
            [ donar ]
          </Link>
          <Link href="/forum" className="btn">
            [ entrar al foro ]
          </Link>
          <Link href="/auth/register" className="btn secondary">
            [ crear cuenta ]
          </Link>
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="n">RXos</div>
            <div className="l">bare-metal x86</div>
          </div>
          <div className="stat">
            <div className="n">00s</div>
            <div className="l">web aesthetic</div>
          </div>
          <div className="stat">
            <div className="n">0</div>
            <div className="l">surveillance ads</div>
          </div>
        </div>
      </Panel>

      <div className="grid-3">
        <div className="card">
          <span className="tag ok">01</span>
          <h3>// donar</h3>
          <p className="muted">
            PayPal, Ko-fi, BTC, SOL, USDT. Cada satoshi va a toolchain,
            hardware de prueba y café del kernel.
          </p>
          <Link href="/donate">abrir canal de donación →</Link>
        </div>
        <div className="card">
          <span className="tag hot">02</span>
          <h3>// rxos-dev</h3>
          <p className="muted">
            Kernel, drivers, UI, neuromórfico. Si sabes C, asm, rust o solo
            quieres reportar bugs en QEMU — el foro te espera.
          </p>
          <Link href="/forum/rxos">ir a // rxos-dev →</Link>
        </div>
        <div className="card">
          <span className="tag">03</span>
          <h3>// debate</h3>
          <p className="muted">
            Privacidad, open hardware, soberanía digital, política de la
            máquina. Registro + login. Sin karma farm. Solo señal.
          </p>
          <Link href="/forum">abrir foro →</Link>
        </div>
      </div>

      <Panel title="~/about · who_we_are">
        <h2>qué es esto</h2>
        <p>
          <strong>knightscomputer.club</strong> es la cara pública del club:
          landing + foro. No es un producto SaaS. Es un punto de encuentro
          para gente que quiere que la computación vuelva a ser herramienta,
          no granja de atención.
        </p>
        <hr className="hr" />
        <h3>stack del nodo</h3>
        <p className="muted">
          Next.js · Vercel · Neon Postgres (nube) · JWT httpOnly · bcrypt ·
          cero frameworks de UI corporativos
        </p>
        <p>
          ¿Querés contribuir al sitio o al OS?{" "}
          <Link href="/auth/register">registrate</Link>, presentate en{" "}
          <Link href="/forum/general">// general</Link> y abrí un hilo en{" "}
          <Link href="/forum/rxos">// rxos-dev</Link>.
        </p>
      </Panel>

      <div className="under-const lobby-const">
        ★ LOBBY OPEN ★ — elevator music playing — ★ PLEASE TAKE A SEAT ★
      </div>
    </div>
  );
}
