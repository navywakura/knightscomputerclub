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

  // Migración suave si la tabla ya existía sin is_vip
  await db`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await db`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(128) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0
    )
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

  // Seed default categories if empty
  const existing = await db`SELECT COUNT(*)::int AS n FROM categories`;
  if (existing[0]?.n === 0) {
    await db`
      INSERT INTO categories (slug, name, description, sort_order) VALUES
        ('general', '// general', 'Charla libre del nodo. Presentaciones, ruido, ideas.', 10),
        ('rxos', '// rxos-dev', 'Desarrollo de RXos: kernel, drivers, toolchain, bugs.', 20),
        ('debate', '// debate', 'Política tech, privacidad, open hardware, activismo digital.', 30),
        ('ops', '// ops-infra', 'Infra, despliegues, donaciones, coordinación del club.', 40)
    `;
  }

  // Owner del nodo: roger / rogynavarro@gmail.com
  await db`
    UPDATE users
    SET role = 'owner'
    WHERE lower(username) = 'roger'
       OR lower(email) = 'rogynavarro@gmail.com'
  `;
}

export type UserRow = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  is_vip: boolean;
  created_at: string;
};

export type PublicUser = {
  id: number;
  username: string;
  role: string;
  is_vip: boolean;
  created_at: string;
};

export type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
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
