import type { Metadata } from "next";
import Link from "next/link";
import Panel from "@/components/Panel";
import { getDb } from "@/lib/db";

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

/** Revalida censo cada minuto — home se siente viva sin martillar Neon. */
export const revalidate = 60;

const ASCII = `
 ██╗  ██╗ ██████╗
 ██║ ██╔╝██╔════╝
 █████╔╝ ██║     
 ██╔═██╗ ██║     
 ██║  ██╗╚██████╗
 ╚═╝  ╚═╝ ╚═════╝
 knightscomputer.club // underground node
`;

type LobbyStats = {
  users: number;
  threads: number;
  posts: number;
  online: number;
  boards: number;
};

async function getLobbyStats(): Promise<LobbyStats> {
  const empty: LobbyStats = {
    users: 0,
    threads: 0,
    posts: 0,
    online: 0,
    boards: 0,
  };
  if (!process.env.DATABASE_URL?.trim()) return empty;

  try {
    const db = getDb();
    const rows = await db`
      SELECT
        (SELECT COUNT(*)::int
           FROM users
          WHERE banned IS NOT TRUE
            AND deleted_at IS NULL) AS users,
        (SELECT COUNT(*)::int FROM threads) AS threads,
        (SELECT COUNT(*)::int FROM posts) AS posts,
        (SELECT COUNT(*)::int
           FROM users
          WHERE banned IS NOT TRUE
            AND deleted_at IS NULL
            AND last_seen IS NOT NULL
            AND last_seen > NOW() - INTERVAL '15 minutes') AS online,
        (SELECT COUNT(*)::int FROM categories) AS boards
    `;
    const r = rows[0];
    return {
      users: Number(r?.users ?? 0),
      threads: Number(r?.threads ?? 0),
      posts: Number(r?.posts ?? 0),
      online: Number(r?.online ?? 0),
      boards: Number(r?.boards ?? 0),
    };
  } catch (e) {
    // fallback si deleted_at / last_seen no existen aún
    try {
      const db = getDb();
      const rows = await db`
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE banned IS NOT TRUE) AS users,
          (SELECT COUNT(*)::int FROM threads) AS threads,
          (SELECT COUNT(*)::int FROM posts) AS posts,
          (SELECT COUNT(*)::int FROM categories) AS boards
      `;
      const r = rows[0];
      return {
        users: Number(r?.users ?? 0),
        threads: Number(r?.threads ?? 0),
        posts: Number(r?.posts ?? 0),
        online: 0,
        boards: Number(r?.boards ?? 0),
      };
    } catch (e2) {
      console.error("[lobby stats]", e, e2);
      return empty;
    }
  }
}

/** Contador estilo LED / BBS clásico */
function padCount(n: number, width = 4): string {
  const s = String(Math.max(0, Math.floor(n)));
  return s.length >= width ? s : s.padStart(width, "0");
}

export default async function HomePage() {
  const stats = await getLobbyStats();

  return (
    <div className="lobby-home">
      <div className="lobby-marquee" aria-hidden>
        <span>
          ★ PLEASE HOLD ★ ELEVATOR MUSIC ★ GROUND FLOOR · FORUM · DONATE ★
          WELCOME TO THE LOBBY ★ {padCount(stats.users)} OPERATORS ONLINE IN
          THE BOOKS ★ NON-COPYRIGHT JAZZ ★
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

        {/* Censo del nodo — ancla social / prueba de vida */}
        <aside className="lobby-census" aria-label="Censo del nodo">
          <div className="lobby-census-head">
            <span className="lobby-census-live" aria-hidden>
              <span className="lobby-census-pulse" />
              LIVE
            </span>
            <span className="lobby-census-label">// node census</span>
            <span className="lobby-census-hint muted">
              operadores registrados · señal del foro
            </span>
          </div>

          <div className="lobby-census-hero">
            <div className="lobby-census-hero-num" title="usuarios registrados">
              {padCount(stats.users)}
            </div>
            <div className="lobby-census-hero-meta">
              <div className="lobby-census-hero-title">operadores en el nodo</div>
              <p className="lobby-census-hero-copy">
                {stats.users === 0
                  ? "El libro de registros está vacío — sé el primero en firmar."
                  : stats.users === 1
                    ? "Un operador ya está adentro. El nodo crece con cada cuenta."
                    : `${stats.users} cuentas activas. Sin algoritmos: solo gente real.`}
              </p>
              <Link href="/auth/register" className="lobby-census-cta">
                → unirse al censo / crear cuenta
              </Link>
            </div>
          </div>

          <div className="stat-row lobby-census-stats">
            <div className="stat lobby-stat-hot" title="usuarios registrados">
              <div className="n">{padCount(stats.users)}</div>
              <div className="l">registrados</div>
            </div>
            <div className="stat" title="en línea (15 min)">
              <div className="n">{padCount(stats.online, 3)}</div>
              <div className="l">en línea</div>
            </div>
            <div className="stat" title="hilos del foro">
              <div className="n">{padCount(stats.threads)}</div>
              <div className="l">hilos</div>
            </div>
            <div className="stat" title="mensajes / posts">
              <div className="n">{padCount(stats.posts)}</div>
              <div className="l">posts</div>
            </div>
            <div className="stat" title="boards / categorías">
              <div className="n">{padCount(stats.boards, 3)}</div>
              <div className="l">boards</div>
            </div>
          </div>
        </aside>

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
        ★ LOBBY OPEN ★ — elevator music playing — ★{" "}
        {padCount(stats.users)} OPERATORS ON FILE ★ PLEASE TAKE A SEAT ★
      </div>
    </div>
  );
}
