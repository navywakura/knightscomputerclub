/**
 * Siembra hilos de apertura en cada board del foro (idempotente).
 * Uso: npm run db:seed-threads
 *      DATABASE_URL=... node scripts/seed-threads.mjs
 *
 * Requiere al menos un usuario (preferido: roger). Si no hay nadie,
 * crea la cuenta bot `nodo` como autor de los seeds.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Copia .env.example → .env.local");
  process.exit(1);
}

const sql = neon(url);

/** @type {Array<{ category_slug: string, title: string, body: string, sticky?: boolean }>} */
const SEED_THREADS = [
  {
    category_slug: "general",
    title: "[PRESENTACIÓN] ¿Cómo llegaste al nodo y qué OS/setup usas a diario?",
    body: `Dejad vuestro saludo, distro/SO actual, terminal preferida y qué os trajo hasta **knightscomputer.club**.

Sin algoritmos, solo charla directa.

---
_Hilo semilla del nodo. Respondé y presentate — el resto del board se construye con vos._`,
    sticky: true,
  },
  {
    category_slug: "rxos",
    title:
      "[DISCUSIÓN] Planificando la arquitectura del Kernel: Event-driven vs Microkernel",
    body: `Para el desarrollo de **RXos**, ¿qué ventajas le veis a un enfoque basado en eventos frente a la separación estricta de microkernel tradicional en x86-64?

Acepto sugerencias de código en C/Rust y diagramas.

---
_Abrí el debate técnico. PRs de ideas bienvenidas._`,
    sticky: true,
  },
  {
    category_slug: "debate",
    title: "La muerte de la Web Abierta: ¿Estamos a tiempo de descentralizar la red?",
    body: `Entre redes sociales corporativas, DRM en navegadores y feeds algorítmicos diseñados para polarizar, ¿creéis que iniciativas independientes todavía pueden romper la hegemonía del software comercial?

Traé argumentos, no slogans. Fuentes > vibes.`,
    sticky: true,
  },
  {
    category_slug: "ops",
    title:
      "[FEEDBACK] Rendimiento del Nodo en Vercel vs Servidor Dedicado (OpenBSD)",
    body: `Estamos probando la latencia actual del foro y las salas de chat.

Si notáis algún delay en el renderizado de posts o queréis sugerir mejoras en la DB de baja latencia, dejad vuestro log/feedback aquí.

\`\`\`
# ejemplo: timing desde tu lado
curl -w "%{time_total}\\n" -o /dev/null -s https://knightscomputer.club/forum
\`\`\``,
    sticky: true,
  },
  {
    category_slug: "news",
    title: "[ANUNCIO] Lanzamiento oficial del nodo e integración de Pastebin ZK",
    body: `Abrimos las puertas de la infraestructura.

Se han habilitado:

- donaciones para el servidor
- temas personalizados para usuarios VIP
- cifrado *zero-knowledge* cliente-side en \`// paste\`

Bienvenidos al club. Sin algoritmos, sin venta de atención.`,
    sticky: true,
  },
  {
    category_slug: "random",
    title: "Muestra tu escritorio / workspace (Dotfiles & CRT Vibe)",
    body: `Sube una captura o foto de tu espacio de trabajo, entorno de escritorio (WM, Neovim, terminales) o la estación retro que tengas montada.

Dotfiles links bienvenidos. Flex de monocromos y CRTs especialmente bienvenido.`,
    sticky: true,
  },
  {
    category_slug: "memes",
    title: "Memes de bajo nivel, C, C++ y punteros colgados",
    body: `Espacio para volcar todo el humor técnico sobre \`segfaults\`, gestión de memoria, compiladores a las 3 AM y batallas de distros.

Regla blanda: si te ríes y duele, va acá.`,
    sticky: true,
  },
  {
    category_slug: "anime",
    title:
      "Obras cyberpunk, psicológicas y retro (Lain, Ergo Proxy, Texhnolyze)",
    body: `Hilo para debatir anime noventero/2000s enfocado en ciencia ficción, ordenadores, identidad y la Wired.

¿Cuáles son vuestros imprescindibles? ¿Serial Experiments Lain cambió algo en cómo mirás la red?`,
    sticky: true,
  },
  {
    category_slug: "ciencia",
    title: "Computación Neuromórfica y Hardware Cuántico",
    body: `Abrimos hilo para compartir papers, avances y debates sobre arquitecturas de chips sintéticos que imitan redes neuronales físicas y criptografía resistente a ordenadores cuánticos.

Papers > hype de LinkedIn.`,
    sticky: true,
  },
  {
    category_slug: "dibujos",
    title: "[GALERÍA] Pixel Art, UI Concept Art y bocetos",
    body: `Comparte tus proyectos visuales, arte digital, maquetación o conceptos gráficos en los que estés trabajando.

WIP, sketches y pixel art del nodo bienvenidos.`,
    sticky: true,
  },
  {
    category_slug: "cocina",
    title: "Platos tradicionales y recetas perfectas para largas sesiones de código",
    body: `¿Qué cocináis cuando tenéis tiempo?

Compartid trucos, desde arroz frito/Nasi Goreng o paellas hasta platos rápidos para aguantar la noche en la terminal.

Café de mala calidad también es válido si lo defendés con pasión.`,
    sticky: true,
  },
  {
    category_slug: "musica",
    title:
      "[PLAYLIST] Ambient, Cyberpunk, Synthwave y Música Clásica/Sonatas",
    body: `Recomendad álbumes o pistas ideales para programar, concentrarse o dejar sonar de fondo.

¿Qué queréis que suene en el reproductor **NODE SIGNAL**?

Links a Bandcamp / YouTube / archivos locales del alma.`,
    sticky: true,
  },
  {
    category_slug: "esoterismo",
    title: "El Kybalion y las leyes herméticas aplicadas a la realidad",
    body: `Debates sobre hermetismo, simbolismo antiguo y cómo la filosofía clásica interpreta la causa, el efecto y la mente.

Traé lectura, no solo citas sueltas. Escepticismo bienvenido al lado de la curiosidad.`,
    sticky: true,
  },
  {
    category_slug: "ufologia",
    title: "Análisis de desclasificaciones recientes de UAPs/OVNIs",
    body: `Recopilación de informes, avistamientos documentados y datos oficiales sobre fenómenos aéreos no identificados.

Preferimos PDFs de agencias y reportes con cadena de custodia a capturas de TikTok.`,
    sticky: true,
  },
  {
    category_slug: "aliens",
    title: "La Paradoja de Fermi y las hipótesis de contacto",
    body: `Si el universo es tan vasto, ¿dónde están?

Debate sobre la hipótesis de la Tierra Rara, el Gran Filtro o civilizaciones no detectadas.

Sin antropocentrismo barato: argumentos, modelos, lecturas.`,
    sticky: true,
  },
  {
    category_slug: "paranormal",
    title: "Experiencias extrañas y anomalías sin explicación lógica",
    body: `Hilo abierto para contar sucesos inexplicables, fallos en la percepción o experiencias paranormales vividas de primera mano.

Respeto al relato. El análisis crítico también cabe acá.`,
    sticky: true,
  },
  {
    category_slug: "awakening",
    title: "Sincronicidades, percepción y cambio de conciencia",
    body: `¿Habéis experimentado patrones numéricos, sincronicidades o momentos donde sentís que la percepción colectiva está cambiando?

Sin MLM de gurus. Experiencia personal y reflexión, no cursos milagro.`,
    sticky: true,
  },
  {
    category_slug: "religion",
    title: "Gnosticismo, textos apócrifos y teología comparada",
    body: `Análisis histórico y filosófico sobre los mitos de creación, corrientes gnósticas y la búsqueda del conocimiento prohibido.

Respeto entre credos. Proselitismo agresivo out.`,
    sticky: true,
  },
  {
    category_slug: "espiritualidad",
    title: "Mapas de meditación, viajes astrales y geometría sagrada",
    body: `Métodos de introspección, estados alterados de conciencia de forma natural y simbolismo geométrico en la naturaleza.

Práctica > dogma. Compartí lo que te funciona (o no).`,
    sticky: true,
  },
  {
    category_slug: "conspiracion",
    title: "Vigilancia masiva, la historia de ARPANET y el control digital",
    body: `Análisis documentado de la evolución de la red, agencias de inteligencia, privacidad perdida y el origen de las tecnologías modernas.

**Regla del board:** traé fuentes o te miramos feo.`,
    sticky: true,
  },
  {
    category_slug: "folklore",
    title: "Mitología urbana, cryptids y leyendas de la red",
    body: `Desde mitos cibernéticos de los inicios de Internet hasta leyendas folclóricas locales e historias de transmisión oral.

Creepypasta canónica, duendes del barrio y el servidor que solo falla a las 3:33 AM.`,
    sticky: true,
  },
];

async function resolveAuthorId() {
  const preferred = await sql`
    SELECT id, username FROM users
    WHERE deleted_at IS NULL
      AND (
        lower(username) = 'roger'
        OR lower(email) = 'rogynavarro@gmail.com'
      )
    ORDER BY id ASC
    LIMIT 1
  `;
  if (preferred[0]) return preferred[0];

  const owner = await sql`
    SELECT id, username FROM users
    WHERE deleted_at IS NULL AND role = 'owner'
    ORDER BY id ASC
    LIMIT 1
  `;
  if (owner[0]) return owner[0];

  const botHash =
    "$2a$10$GHiRUZ6CF3ShKYMQHWsLoe.6x4pxV5a3dsG.ddGBsaFrcyD3r5fOi";
  await sql`
    INSERT INTO users (username, email, password_hash, role, email_verified)
    VALUES (
      'nodo',
      'nodo@knightscomputer.club',
      ${botHash},
      'member',
      TRUE
    )
    ON CONFLICT (username) DO NOTHING
  `;
  const bot = await sql`
    SELECT id, username FROM users WHERE lower(username) = 'nodo' LIMIT 1
  `;
  return bot[0] || null;
}

async function main() {
  console.log("[kc] sembrando hilos semilla del foro…");

  const author = await resolveAuthorId();
  if (!author) {
    console.error(
      "[kc] sin autor: no hay usuarios y no se pudo crear bot `nodo`"
    );
    process.exit(1);
  }
  console.log(`[kc] autor: @${author.username} (id=${author.id})`);

  let created = 0;
  let skipped = 0;

  for (const seed of SEED_THREADS) {
    const cats = await sql`
      SELECT id, name FROM categories WHERE slug = ${seed.category_slug} LIMIT 1
    `;
    if (!cats[0]) {
      console.warn(`  skip  //${seed.category_slug}  (categoría no existe)`);
      skipped += 1;
      continue;
    }

    const categoryId = Number(cats[0].id);
    const title = seed.title.slice(0, 200);
    const sticky = seed.sticky !== false;

    const existing = await sql`
      SELECT id FROM threads
      WHERE category_id = ${categoryId} AND title = ${title}
      LIMIT 1
    `;
    if (existing[0]) {
      console.log(`  =     ${cats[0].name}  → ya existe`);
      skipped += 1;
      continue;
    }

    const thr = await sql`
      INSERT INTO threads (category_id, author_id, title, sticky, locked)
      VALUES (${categoryId}, ${author.id}, ${title}, ${sticky}, FALSE)
      RETURNING id
    `;
    const threadId = thr[0] ? Number(thr[0].id) : null;
    if (!threadId) {
      skipped += 1;
      continue;
    }

    await sql`
      INSERT INTO posts (thread_id, author_id, body)
      VALUES (${threadId}, ${author.id}, ${seed.body})
    `;
    console.log(`  +     ${cats[0].name}  → #${threadId}  ${title.slice(0, 56)}`);
    created += 1;
  }

  console.log(
    `[kc] listo: ${created} creados, ${skipped} omitidos (total seeds: ${SEED_THREADS.length})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
