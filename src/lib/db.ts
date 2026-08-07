import { neon, NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null = null;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL no configurada. Copia .env.example → .env.local y pega tu connection string de Neon."
    );
  }
  if (!sql) {
    sql = neon(url);
  }
  return sql;
}

export async function ensureSchema() {
  const db = getDb();

  await db`
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

  // Migraciones suaves
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(32)
  `;
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS oauth_subject VARCHAR(128)
  `;
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_users_last_seen
      ON users (last_seen DESC NULLS LAST)
  `;

  await db`
    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      uploader_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mime VARCHAR(64) NOT NULL,
      size_bytes INT NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_media_uploader ON media(uploader_id)
  `;

  await db`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(128) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      parent_id INT REFERENCES categories(id) ON DELETE SET NULL
    )
  `;
  await db`
    ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES categories(id) ON DELETE SET NULL
  `;

  await db`
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

  await db`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      thread_id INT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_threads_category ON threads(category_id)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_posts_thread ON posts(thread_id)
  `;

  await db`
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

  // Notificaciones in-app (kit packages/web-notify)
  await db`
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
  await db`
    CREATE INDEX IF NOT EXISTS idx_web_notifications_inbox
      ON web_notifications (app_id, user_id, created_at DESC)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_web_notifications_unread
      ON web_notifications (app_id, user_id)
      WHERE read_at IS NULL
  `;

  // PIN de DMs (nexo) — 4 dígitos hasheados
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS dm_pin_hash TEXT
  `;
  // Perfil público
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(64)
  `;
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_media_id INT REFERENCES media(id) ON DELETE SET NULL
  `;
  // DMs: everyone | friends
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS dm_privacy VARCHAR(16) NOT NULL DEFAULT 'everyone'
  `;
  // Bio corta (máx 100 en app)
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bio VARCHAR(100) NOT NULL DEFAULT ''
  `;
  // Banner de perfil (solo VIP / owner en API)
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS banner_media_id INT REFERENCES media(id) ON DELETE SET NULL
  `;
  // Conexiones externas (github, twitter/x, website, discord, …)
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS connections JSONB NOT NULL DEFAULT '{}'::jsonb
  `;
  // Verificación email + soft delete (7 días)
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_otp_hash TEXT
  `;
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_otp_expires TIMESTAMPTZ
  `;
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_users_deleted_at
      ON users (deleted_at)
      WHERE deleted_at IS NOT NULL
  `;

  // Amistades
  await db`
    CREATE TABLE IF NOT EXISTS friendships (
      id SERIAL PRIMARY KEY,
      requester_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (requester_id, addressee_id),
      CHECK (requester_id <> addressee_id),
      CHECK (status IN ('pending', 'accepted', 'rejected'))
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status)
  `;

  // ── NEXO: tablones de usuario + chat casi real-time + DMs ──
  await db`
    CREATE TABLE IF NOT EXISTS nexo_boards (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(128) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_nexo_boards_owner ON nexo_boards(owner_id)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_nexo_boards_updated ON nexo_boards(updated_at DESC)
  `;

  await db`
    CREATE TABLE IF NOT EXISTS nexo_messages (
      id SERIAL PRIMARY KEY,
      board_id INT NOT NULL REFERENCES nexo_boards(id) ON DELETE CASCADE,
      author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_nexo_messages_board
      ON nexo_messages(board_id, id DESC)
  `;
  // extras chat: reply, pin, edit, soft-delete
  await db`
    ALTER TABLE nexo_messages
    ADD COLUMN IF NOT EXISTS reply_to_id INT REFERENCES nexo_messages(id) ON DELETE SET NULL
  `;
  await db`
    ALTER TABLE nexo_messages
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await db`
    ALTER TABLE nexo_messages
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ
  `;
  await db`
    ALTER TABLE nexo_messages
    ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await db`
    ALTER TABLE nexo_messages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_nexo_messages_pinned
      ON nexo_messages (board_id, id DESC)
      WHERE pinned IS TRUE AND deleted IS NOT TRUE
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_nexo_messages_updated
      ON nexo_messages (board_id, updated_at DESC)
  `;

  // Miembros por board (lista lateral + presencia)
  await db`
    CREATE TABLE IF NOT EXISTS nexo_board_members (
      board_id INT NOT NULL REFERENCES nexo_boards(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (board_id, user_id)
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_nexo_board_members_seen
      ON nexo_board_members (board_id, last_seen DESC)
  `;

  await db`
    CREATE TABLE IF NOT EXISTS nexo_dm_threads (
      id SERIAL PRIMARY KEY,
      user_low INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_high INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pin_hash TEXT NOT NULL,
      created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_low, user_high)
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS nexo_dm_messages (
      id SERIAL PRIMARY KEY,
      thread_id INT NOT NULL REFERENCES nexo_dm_threads(id) ON DELETE CASCADE,
      author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_nexo_dm_messages_thread
      ON nexo_dm_messages(thread_id, id DESC)
  `;
  await db`
    ALTER TABLE nexo_dm_messages
    ADD COLUMN IF NOT EXISTS reply_to_id INT REFERENCES nexo_dm_messages(id) ON DELETE SET NULL
  `;
  await db`
    ALTER TABLE nexo_dm_messages
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await db`
    ALTER TABLE nexo_dm_messages
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ
  `;
  await db`
    ALTER TABLE nexo_dm_messages
    ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await db`
    ALTER TABLE nexo_dm_messages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `;
  // DMs efímeros: TTL por thread (minutos; 0 = off) + expires_at por mensaje
  await db`
    ALTER TABLE nexo_dm_threads
    ADD COLUMN IF NOT EXISTS ephemeral_minutes INT NOT NULL DEFAULT 0
  `;
  await db`
    ALTER TABLE nexo_dm_messages
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
  `;

  // PGP en perfiles
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS pgp_public_key TEXT
  `;
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS pgp_fingerprint VARCHAR(64)
  `;

  // Reportes (forum / nexo / dm)
  await db`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reporter_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type VARCHAR(24) NOT NULL,
      target_id INT NOT NULL,
      reason VARCHAR(64) NOT NULL DEFAULT 'other',
      details TEXT NOT NULL DEFAULT '',
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (target_type IN ('forum_post', 'forum_thread', 'nexo_message', 'nexo_dm', 'user')),
      CHECK (status IN ('open', 'reviewed', 'dismissed'))
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_reports_status
      ON reports (status, created_at DESC)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_reports_target
      ON reports (target_type, target_id)
  `;

  // Seed / upsert categorías (incluye jerarquía offtopic + nexo)
  await seedCategories(db);

  // Purga mensajes DM efímeros vencidos
  try {
    await db`
      DELETE FROM nexo_dm_messages
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
    `;
  } catch {
    /* */
  }

  // Purga soft-deletes vencidos
  try {
    await db`
      DELETE FROM users
      WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '7 days'
    `;
  } catch {
    /* */
  }

  // Owner del nodo: roger / rogynavarro@gmail.com
  await db`
    UPDATE users
    SET role = 'owner'
    WHERE lower(username) = 'roger'
       OR lower(email) = 'rogynavarro@gmail.com'
  `;
  // Owner siempre verificado
  await db`
    UPDATE users
    SET email_verified = TRUE
    WHERE lower(username) = 'roger'
       OR lower(email) = 'rogynavarro@gmail.com'
  `;
}

/** Boards del foro. parent_slug null = top-level. */
const CATEGORY_SEED: Array<{
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  parent_slug: string | null;
}> = [
  {
    slug: "general",
    name: "// general",
    description: "Charla libre del nodo. Presentaciones, ruido, ideas.",
    sort_order: 10,
    parent_slug: null,
  },
  {
    slug: "rxos",
    name: "// rxos-dev",
    description: "Desarrollo de RXos: kernel, drivers, toolchain, bugs.",
    sort_order: 20,
    parent_slug: null,
  },
  {
    slug: "debate",
    name: "// debate",
    description: "Política tech, privacidad, open hardware, activismo digital.",
    sort_order: 30,
    parent_slug: null,
  },
  {
    slug: "ops",
    name: "// ops-infra",
    description: "Infra, despliegues, donaciones, coordinación del club.",
    sort_order: 40,
    parent_slug: null,
  },
  {
    slug: "offtopic",
    name: "// offtopic",
    description:
      "Zona libre: random, memes, anime, ciencia. Sin contenido NSFW.",
    sort_order: 50,
    parent_slug: null,
  },
  {
    slug: "random",
    name: "// random",
    description:
      "Tablón general principal de offtopic. Charla libre. Sin NSFW.",
    sort_order: 51,
    parent_slug: "offtopic",
  },
  {
    slug: "memes",
    name: "// memes",
    description: "Memes, shitposts e imágenes. Sin contenido NSFW.",
    sort_order: 52,
    parent_slug: "offtopic",
  },
  {
    slug: "anime",
    name: "// anime",
    description: "Anime, manga y cultura otaku. Sin contenido NSFW.",
    sort_order: 53,
    parent_slug: "offtopic",
  },
  {
    slug: "ciencia",
    name: "// ciencia",
    description: "Ciencia, investigación, divulgación y tech hard.",
    sort_order: 54,
    parent_slug: "offtopic",
  },
  {
    slug: "nexo",
    name: "// nexo",
    description:
      "Hub de tablones de usuario (crear board = VIP). Chat casi real-time + DMs con PIN.",
    sort_order: 60,
    parent_slug: null,
  },
];

async function seedCategories(db: NeonQueryFunction<false, false>) {
  // 1) Upsert top-level + all by slug (parent_id after parents exist)
  for (const c of CATEGORY_SEED) {
    await db`
      INSERT INTO categories (slug, name, description, sort_order)
      VALUES (${c.slug}, ${c.name}, ${c.description}, ${c.sort_order})
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order
    `;
  }

  // 2) Wire parent_id for subcategorías
  for (const c of CATEGORY_SEED) {
    if (!c.parent_slug) {
      await db`
        UPDATE categories SET parent_id = NULL WHERE slug = ${c.slug}
      `;
      continue;
    }
    await db`
      UPDATE categories
      SET parent_id = (SELECT id FROM categories WHERE slug = ${c.parent_slug} LIMIT 1)
      WHERE slug = ${c.slug}
    `;
  }
}

export type UserConnections = {
  github?: string;
  twitter?: string;
  website?: string;
  discord?: string;
  youtube?: string;
};

export type UserRow = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  is_vip: boolean;
  banned: boolean;
  created_at: string;
  display_name?: string | null;
  avatar_media_id?: number | null;
  banner_media_id?: number | null;
  dm_privacy?: string | null;
  bio?: string | null;
  email_verified?: boolean;
  deleted_at?: string | null;
  connections?: UserConnections | string | null;
};

export type PublicUser = {
  id: number;
  username: string;
  role: string;
  is_vip: boolean;
  banned: boolean;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  dm_privacy: "everyone" | "friends";
  bio: string;
  connections: UserConnections;
  email_verified: boolean;
  email?: string;
  pending_deletion?: boolean;
  deletion_deadline?: string | null;
};

export type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  parent_id: number | null;
};

export type ThreadRow = {
  id: number;
  category_id: number;
  author_id: number;
  title: string;
  locked: boolean;
  sticky: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string;
  post_count?: number;
  category_slug?: string;
  category_name?: string;
};

export type PostRow = {
  id: number;
  thread_id: number;
  author_id: number;
  body: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_role?: string;
  author_is_vip?: boolean;
};
