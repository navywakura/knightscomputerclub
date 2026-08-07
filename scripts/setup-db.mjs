/**
 * Inicializa el schema del foro en Neon Postgres.
 * Uso: DATABASE_URL=... node scripts/setup-db.mjs
 * o: npm run db:setup  (con .env.local cargado manualmente)
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

async function main() {
  console.log("[kc] creando tablas…");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(32) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'member',
      is_vip BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(32)
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS oauth_subject VARCHAR(128)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      uploader_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mime VARCHAR(64) NOT NULL,
      size_bytes INT NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_media_uploader ON media(uploader_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(128) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS threads (
      id SERIAL PRIMARY KEY,
      category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      locked BOOLEAN NOT NULL DEFAULT FALSE,
      sticky BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      thread_id INT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_threads_category ON threads(category_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_thread ON posts(thread_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS link_previews (
      url TEXT PRIMARY KEY,
      final_url TEXT NOT NULL DEFAULT '',
      title TEXT,
      description TEXT,
      image TEXT,
      site_name TEXT,
      ok BOOLEAN NOT NULL DEFAULT FALSE,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS web_notifications (
      id            BIGSERIAL PRIMARY KEY,
      app_id        VARCHAR(64)  NOT NULL DEFAULT 'default',
      user_id       BIGINT       NOT NULL,
      type          VARCHAR(64)  NOT NULL DEFAULT 'system',
      title         VARCHAR(280) NOT NULL,
      body          TEXT         NOT NULL DEFAULT '',
      href          TEXT,
      actor_id      BIGINT,
      actor_label   VARCHAR(128),
      payload       JSONB        NOT NULL DEFAULT '{}'::jsonb,
      read_at       TIMESTAMPTZ,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_web_notifications_inbox
      ON web_notifications (app_id, user_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_web_notifications_unread
      ON web_notifications (app_id, user_id)
      WHERE read_at IS NULL
  `;

  const existing = await sql`SELECT COUNT(*)::int AS n FROM categories`;
  if (existing[0]?.n === 0) {
    await sql`
      INSERT INTO categories (slug, name, description, sort_order) VALUES
        ('general', '// general', 'Charla libre del nodo. Presentaciones, ruido, ideas.', 10),
        ('rxos', '// rxos-dev', 'Desarrollo de RXos: kernel, drivers, toolchain, bugs.', 20),
        ('debate', '// debate', 'Política tech, privacidad, open hardware, activismo digital.', 30),
        ('ops', '// ops-infra', 'Infra, despliegues, donaciones, coordinación del club.', 40)
    `;
    console.log("[kc] categorías seed OK");
  } else {
    console.log("[kc] categorías ya existen, skip seed");
  }

  const owners = await sql`
    UPDATE users
    SET role = 'owner'
    WHERE lower(username) = 'roger'
       OR lower(email) = 'rogynavarro@gmail.com'
    RETURNING id, username, email, role
  `;
  if (owners.length) {
    console.log("[kc] owner rank:", owners.map((o) => o.username).join(", "));
  } else {
    console.log(
      "[kc] owner: sin usuario roger / rogynavarro@gmail.com aún (se asigna al registrarse o en ensureSchema)"
    );
  }

  console.log("[kc] schema listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
