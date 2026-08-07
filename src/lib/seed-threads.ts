/**
 * Hilos semilla del foro — evitan la "hoja en blanco".
 * Se ejecuta 1 vez por versión (app_meta.forum_seed_version).
 * Idempotente también por título (reintentos seguros si falló a medias).
 */
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Db = NeonQueryFunction<false, false>;

/** Subir cuando cambie el catálogo de seeds (replies, hilos nuevos, etc.). */
export const FORUM_SEED_VERSION = 2;

const META_KEY = "forum_seed_version";

export type SeedThread = {
  category_slug: string;
  title: string;
  body: string;
  sticky?: boolean;
  /** Respuestas dummy (1–2 en hilos clave). Idempotentes por body exacto. */
  replies?: string[];
};

const BOT_HASH =
  "$2a$10$GHiRUZ6CF3ShKYMQHWsLoe.6x4pxV5a3dsG.ddGBsaFrcyD3r5fOi";

/**
 * Colección de hilos de apertura + replies en boards clave.
 */
export const SEED_THREADS: SeedThread[] = [
  // ── Core ──────────────────────────────────────────────────────────
  {
    category_slug: "general",
    title: "[PRESENTACIÓN] ¿Cómo llegaste al nodo y qué OS/setup usas a diario?",
    body: `Dejad vuestro saludo, distro/SO actual, terminal preferida y qué os trajo hasta **knightscomputer.club**.

Sin algoritmos, solo charla directa.

---
_Hilo semilla del nodo. Respondé y presentate — el resto del board se construye con vos._`,
    sticky: true,
    replies: [
      `hola nodo 👋  
**Arch · Hyprland · foot + tmux · neovim**  
llegué por RXos / el lab. cero timelines, solo señal.  
¿alguien más en bare metal sin DE?`,
      `Void musl + dwm.  
Terminal: st patchado.  
Vine a dejar de scrollear y a codear kernel otra vez.  
Bienvenidos al club — presentense sin CV corporativo.`,
    ],
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
    replies: [
      `voto **híbrido**: microkernel para drivers/IPC, event loop en el scheduler (menos context switch que pure micro en hot path).  
en Rust se puede modelar con \`async\` + channels sin meter un runtime pesado en ring0.  
si alguien tiene diagramas de seL4 / Fuchsia, tiren links.`,
    ],
  },
  {
    category_slug: "debate",
    title: "La muerte de la Web Abierta: ¿Estamos a tiempo de descentralizar la red?",
    body: `Entre redes sociales corporativas, DRM en navegadores y feeds algorítmicos diseñados para polarizar, ¿creéis que iniciativas independientes todavía pueden romper la hegemonía del software comercial?

Traé argumentos, no slogans. Fuentes > vibes.`,
    sticky: true,
    replies: [
      `sí, pero no con "otra app más" que copie el feed infinito.  
funciona lo **pequeño y federable**: foros, ActivityPub, IPFS para estáticos, clientes que no venden atención.  
el cuello de botella no es tech — es atención y red de confianza. nodos como este son la prueba.`,
      `el DRM en el browser es el canario.  
mientras el stack del usuario sea un kiosk de 3 corpos, "descentralizar" es cosmético.  
soberanía = hardware + SO + red. RXos + clubes locales > otro SaaS "ético".`,
    ],
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
    replies: [
      `copy.  
paste ZK client-side es el feature correcto: el server no debería poder leerte ni aunque quiera.  
si alguien dona, que sea por infra — no por "badges de engagement". 🫡`,
    ],
  },

  // ── offtopic ──────────────────────────────────────────────────────
  {
    category_slug: "random",
    title: "Muestra tu escritorio / workspace (Dotfiles & CRT Vibe)",
    body: `Sube una captura o foto de tu espacio de trabajo, entorno de escritorio (WM, Neovim, terminales) o la estación retro que tengas montada.

Dotfiles links bienvenidos. Flex de monocromos y CRTs especialmente bienvenido.`,
    sticky: true,
    replies: [
      `CRT 15" monocromo verde + Thinkpad T480 + void.  
dotfiles en un repo privado (paranoia).  
si posteas wallpaper 80s synth, +1 respeto.`,
    ],
  },
  {
    category_slug: "memes",
    title: "Memes de bajo nivel, C, C++ y punteros colgados",
    body: `Espacio para volcar todo el humor técnico sobre \`segfaults\`, gestión de memoria, compiladores a las 3 AM y batallas de distros.

Regla blanda: si te ríes y duele, va acá.`,
    sticky: true,
    replies: [
      `\`\`\`
Segmentation fault (core dumped)
\`\`\`  
traducción: "funciona en mi máquina" pero el puntero ya se fue de vacaciones.`,
      `C++: "zero-cost abstractions"  
yo: *mirando el template error de 400 líneas*  
el compilador: *también se ríe*`,
    ],
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

  // ── hobby ─────────────────────────────────────────────────────────
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
    replies: [
      `para deep work: Brian Eno *Music for Airports* + un poco de Aphex Twin *SAW 85-92*.  
si el kernel no compila, subo el gain a synthwave y rezo.`,
    ],
  },

  // ── misterio ──────────────────────────────────────────────────────
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

/** Bots de relleno (password inutilizable). Variedad en OP vs replies. */
const SEED_BOTS: Array<{ username: string; email: string }> = [
  { username: "nodo", email: "nodo@knightscomputer.club" },
  { username: "crt_walker", email: "crt_walker@knightscomputer.club" },
  { username: "nullptr", email: "nullptr@knightscomputer.club" },
];

async function ensureAppMetaTable(db: Db) {
  await db`
    CREATE TABLE IF NOT EXISTS app_meta (
      key VARCHAR(64) PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getSeedVersion(db: Db): Promise<number> {
  try {
    const rows = await db`
      SELECT value FROM app_meta WHERE key = ${META_KEY} LIMIT 1
    `;
    return Number(rows[0]?.value || 0) || 0;
  } catch {
    return 0;
  }
}

async function setSeedVersion(db: Db, version: number) {
  await db`
    INSERT INTO app_meta (key, value, updated_at)
    VALUES (${META_KEY}, ${String(version)}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `;
}

/**
 * Autor principal de seeds: roger → owner → bot `nodo`.
 * No filtra deleted_at (evita fallos en esquemas a medias).
 */
async function ensureSeedBots(db: Db): Promise<{
  primaryId: number | null;
  botIds: number[];
}> {
  const botIds: number[] = [];

  for (const bot of SEED_BOTS) {
    try {
      await db`
        INSERT INTO users (username, email, password_hash, role, email_verified)
        VALUES (
          ${bot.username},
          ${bot.email},
          ${BOT_HASH},
          'member',
          TRUE
        )
        ON CONFLICT (username) DO NOTHING
      `;
    } catch (e) {
      // email conflict u otro: intentar solo por username existente
      console.error("[seed] bot insert", bot.username, e);
    }
  }

  for (const bot of SEED_BOTS) {
    const rows = await db`
      SELECT id FROM users WHERE lower(username) = ${bot.username} LIMIT 1
    `;
    if (rows[0]) botIds.push(Number(rows[0].id));
  }

  // preferir roger / owner como autor del OP sticky
  try {
    const preferred = await db`
      SELECT id FROM users
      WHERE lower(username) = 'roger'
         OR lower(email) = 'rogynavarro@gmail.com'
      ORDER BY id ASC
      LIMIT 1
    `;
    if (preferred[0]) {
      return { primaryId: Number(preferred[0].id), botIds };
    }
  } catch (e) {
    console.error("[seed] preferred author", e);
  }

  try {
    const owner = await db`
      SELECT id FROM users
      WHERE role = 'owner'
      ORDER BY id ASC
      LIMIT 1
    `;
    if (owner[0]) {
      return { primaryId: Number(owner[0].id), botIds };
    }
  } catch (e) {
    console.error("[seed] owner author", e);
  }

  return {
    primaryId: botIds[0] ?? null,
    botIds,
  };
}

export type SeedThreadsResult = {
  authorId: number | null;
  created: number;
  repliesCreated: number;
  skipped: number;
  alreadyDone: boolean;
  version: number;
  missingCategories: string[];
  error?: string;
};

/**
 * Inserta hilos + replies semilla. Corre una vez por FORUM_SEED_VERSION.
 */
export async function seedForumThreads(db: Db): Promise<SeedThreadsResult> {
  const empty: SeedThreadsResult = {
    authorId: null,
    created: 0,
    repliesCreated: 0,
    skipped: 0,
    alreadyDone: false,
    version: FORUM_SEED_VERSION,
    missingCategories: [],
  };

  try {
    await ensureAppMetaTable(db);
  } catch (e) {
    console.error("[seed] app_meta", e);
    return { ...empty, error: "app_meta failed" };
  }

  const current = await getSeedVersion(db);
  if (current >= FORUM_SEED_VERSION) {
    return { ...empty, alreadyDone: true, version: current };
  }

  const { primaryId, botIds } = await ensureSeedBots(db);
  if (!primaryId) {
    console.error("[seed] sin autor — no se pudieron crear bots");
    return { ...empty, error: "no author" };
  }

  // categorías en un solo round-trip
  const catRows = await db`SELECT id, slug FROM categories`;
  const catBySlug = new Map<string, number>();
  for (const c of catRows) {
    catBySlug.set(String(c.slug), Number(c.id));
  }

  let created = 0;
  let repliesCreated = 0;
  let skipped = 0;
  const missingCategories: string[] = [];
  const seenMissing = new Set<string>();

  for (let i = 0; i < SEED_THREADS.length; i++) {
    const seed = SEED_THREADS[i];
    const categoryId = catBySlug.get(seed.category_slug);
    if (!categoryId) {
      if (!seenMissing.has(seed.category_slug)) {
        seenMissing.add(seed.category_slug);
        missingCategories.push(seed.category_slug);
      }
      skipped += 1;
      continue;
    }

    const title = seed.title.slice(0, 200);
    const sticky = seed.sticky !== false;

    let threadId: number | null = null;
    const existing = await db`
      SELECT id FROM threads
      WHERE category_id = ${categoryId}
        AND title = ${title}
      LIMIT 1
    `;
    if (existing[0]) {
      threadId = Number(existing[0].id);
      skipped += 1;
      // re-sticky por si se creó sin sticky antes
      try {
        await db`
          UPDATE threads SET sticky = TRUE WHERE id = ${threadId} AND sticky IS NOT TRUE
        `;
      } catch {
        /* */
      }
    } else {
      try {
        const thr = await db`
          INSERT INTO threads (category_id, author_id, title, sticky, locked)
          VALUES (${categoryId}, ${primaryId}, ${title}, ${sticky}, FALSE)
          RETURNING id
        `;
        threadId = thr[0] ? Number(thr[0].id) : null;
        if (!threadId) {
          skipped += 1;
          continue;
        }
        await db`
          INSERT INTO posts (thread_id, author_id, body)
          VALUES (${threadId}, ${primaryId}, ${seed.body})
        `;
        created += 1;
      } catch (e) {
        console.error("[seed] thread", seed.category_slug, e);
        skipped += 1;
        continue;
      }
    }

    // replies dummy
    if (threadId && seed.replies?.length) {
      for (let r = 0; r < seed.replies.length; r++) {
        const body = seed.replies[r];
        const replyAuthor =
          botIds.length > 0
            ? botIds[(i + r + 1) % botIds.length]
            : primaryId;
        try {
          const dup = await db`
            SELECT id FROM posts
            WHERE thread_id = ${threadId}
              AND body = ${body}
            LIMIT 1
          `;
          if (dup[0]) continue;
          await db`
            INSERT INTO posts (thread_id, author_id, body)
            VALUES (${threadId}, ${replyAuthor}, ${body})
          `;
          // bump updated_at del hilo
          await db`
            UPDATE threads SET updated_at = NOW() WHERE id = ${threadId}
          `;
          repliesCreated += 1;
        } catch (e) {
          console.error("[seed] reply", seed.category_slug, e);
        }
      }
    }
  }

  // Solo marcar versión completa si no faltaron categorías críticas
  // (general debe existir). Si faltan cats, no marcamos → reintenta.
  const hasGeneral = catBySlug.has("general");
  if (hasGeneral && missingCategories.length === 0) {
    await setSeedVersion(db, FORUM_SEED_VERSION);
  } else if (hasGeneral && created + skipped >= SEED_THREADS.length * 0.5) {
    // mayoría sembrada: marcar igual para no martillar prod
    await setSeedVersion(db, FORUM_SEED_VERSION);
  }

  console.log(
    `[seed] forum v${FORUM_SEED_VERSION}: created=${created} replies=${repliesCreated} skipped=${skipped} missing=${missingCategories.join(",") || "—"}`
  );

  return {
    authorId: primaryId,
    created,
    repliesCreated,
    skipped,
    alreadyDone: false,
    version: FORUM_SEED_VERSION,
    missingCategories,
  };
}

/**
 * Fuerza re-seed (borra flag). Uso: scripts / admin.
 */
export async function resetForumSeedFlag(db: Db) {
  await ensureAppMetaTable(db);
  await db`DELETE FROM app_meta WHERE key = ${META_KEY}`;
}
