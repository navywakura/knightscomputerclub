import Link from "next/link";
import Panel from "@/components/Panel";

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
    <>
      <Panel title="~/boot · welcome.sh">
        <pre className="ascii">{ASCII}</pre>
        <h1 className="glitch glow" data-text="ACCESO AL NODO">
          ACCESO AL NODO
        </h1>
        <p className="prompt">
          <span className="cmd">root@kc:~$</span> cat manifesto.txt
          <span className="cursor" />
        </p>
        <p>
          Somos un <strong>nodo tecnoactivista</strong>: computación libre,
          hardware sin cadenas, software que no te vigila. Aquí se dona al
          desarrollo de <strong>RXos</strong>, se escribe código, y se debate
          sin algoritmo que te empuje al odio.
        </p>
        <p className="muted">
          estética 2000 · terminal · underground · sin ads · sin trackers
          corporativos
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
            PayPal, Ko-fi, BTC, SOL, USDT. Placeholders hasta que el tesoro
            esté listo. Cada satoshi va a toolchain, hardware de prueba y
            café del kernel.
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

      <div className="under-const">
        ★ UNDER CONSTRUCTION ★ — el club crece en público — ★ BUILD IN
        PROGRESS ★
      </div>
    </>
  );
}
