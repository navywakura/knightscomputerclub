import { NextResponse } from "next/server";
import {
  getSessionUser,
  sanitizeUsername,
  toPublicUser,
} from "@/lib/auth";
import { ensureSchema, getDb, type UserRow } from "@/lib/db";
import {
  profileDeleteSchema,
  profilePatchSchema,
  readJsonBody,
} from "@/lib/validate";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}

/**
 * PATCH perfil: display_name, username, bio, dm_privacy, avatar_media_id,
 * banner_media_id (VIP), connections
 * DELETE cuenta: soft-delete 7 días (restaurar con login)
 */
export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    if (user.pending_deletion) {
      return NextResponse.json(
        {
          error:
            "cuenta en eliminación. Hacé login de nuevo para restaurarla.",
          code: "pending_deletion",
        },
        { status: 403 }
      );
    }

    const parsed = await readJsonBody(req, profilePatchSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data as Record<string, unknown>;
    await ensureSchema();
    const db = getDb();

    async function assertOwnMedia(mid: number) {
      const media = await db`
        SELECT id FROM media
        WHERE id = ${mid} AND uploader_id = ${user!.id}
        LIMIT 1
      `;
      return Boolean(media[0]);
    }

    if ("display_name" in body) {
      let dn = String(body.display_name ?? "").trim().slice(0, 64);
      if (dn && !/^[\p{L}\p{N}\s._\-']+$/u.test(dn)) {
        return NextResponse.json(
          { error: "display_name: solo letras, números, espacios y ._-'" },
          { status: 400 }
        );
      }
      await db`
        UPDATE users
        SET display_name = ${dn || null}
        WHERE id = ${user.id}
      `;
    }

    if ("username" in body) {
      const next = sanitizeUsername(String(body.username || ""));
      if (next.length < 3 || next.length > 32) {
        return NextResponse.json(
          { error: "username 3–32 (a-z 0-9 _ -)" },
          { status: 400 }
        );
      }
      if (next !== user.username.toLowerCase()) {
        const taken = await db`
          SELECT id FROM users
          WHERE lower(username) = ${next} AND id <> ${user.id}
          LIMIT 1
        `;
        if (taken[0]) {
          return NextResponse.json(
            { error: "username ya en uso" },
            { status: 409 }
          );
        }
        await db`
          UPDATE users SET username = ${next} WHERE id = ${user.id}
        `;
      }
    }

    if ("bio" in body) {
      const bio = String(body.bio ?? "").trim().slice(0, 100);
      await db`
        UPDATE users SET bio = ${bio} WHERE id = ${user.id}
      `;
    }

    if ("dm_privacy" in body) {
      const p = String(body.dm_privacy || "everyone");
      if (p !== "everyone" && p !== "friends") {
        return NextResponse.json(
          { error: "dm_privacy: everyone | friends" },
          { status: 400 }
        );
      }
      await db`
        UPDATE users SET dm_privacy = ${p} WHERE id = ${user.id}
      `;
    }

    if ("avatar_media_id" in body) {
      const mid =
        body.avatar_media_id === null || body.avatar_media_id === ""
          ? null
          : Number(body.avatar_media_id);
      if (mid !== null) {
        if (!Number.isFinite(mid)) {
          return NextResponse.json(
            { error: "avatar_media_id inválido" },
            { status: 400 }
          );
        }
        if (!(await assertOwnMedia(mid))) {
          return NextResponse.json(
            { error: "media no encontrada o no es tuya" },
            { status: 404 }
          );
        }
        await db`
          UPDATE users SET avatar_media_id = ${mid} WHERE id = ${user.id}
        `;
      } else {
        await db`
          UPDATE users SET avatar_media_id = NULL WHERE id = ${user.id}
        `;
      }
    }

    if ("banner_media_id" in body) {
      const canBanner = user.is_vip || user.role === "owner";
      if (!canBanner) {
        return NextResponse.json(
          { error: "banner de perfil es exclusivo [VIP]" },
          { status: 403 }
        );
      }
      const mid =
        body.banner_media_id === null || body.banner_media_id === ""
          ? null
          : Number(body.banner_media_id);
      if (mid !== null) {
        if (!Number.isFinite(mid)) {
          return NextResponse.json(
            { error: "banner_media_id inválido" },
            { status: 400 }
          );
        }
        if (!(await assertOwnMedia(mid))) {
          return NextResponse.json(
            { error: "media no encontrada o no es tuya" },
            { status: 404 }
          );
        }
        await db`
          UPDATE users SET banner_media_id = ${mid} WHERE id = ${user.id}
        `;
      } else {
        await db`
          UPDATE users SET banner_media_id = NULL WHERE id = ${user.id}
        `;
      }
    }

    if ("pgp_public_key" in body || "pgp_fingerprint" in body) {
      let key =
        "pgp_public_key" in body
          ? String(body.pgp_public_key ?? "").trim()
          : undefined;
      let fp =
        "pgp_fingerprint" in body
          ? String(body.pgp_fingerprint ?? "")
              .trim()
              .toUpperCase()
              .replace(/[^0-9A-F]/g, "")
              .slice(0, 64)
          : undefined;
      if (key !== undefined) {
        if (key && !key.includes("BEGIN PGP PUBLIC KEY")) {
          return NextResponse.json(
            { error: "pgp_public_key: pegá un bloque PUBLIC KEY" },
            { status: 400 }
          );
        }
        key = key ? key.slice(0, 12000) : "";
        await db`
          UPDATE users
          SET pgp_public_key = ${key || null}
          WHERE id = ${user.id}
        `;
      }
      if (fp !== undefined) {
        await db`
          UPDATE users
          SET pgp_fingerprint = ${fp || null}
          WHERE id = ${user.id}
        `;
      }
    }

    if ("connections" in body && body.connections && typeof body.connections === "object") {
      const raw = body.connections as Record<string, unknown>;
      const keys = ["github", "twitter", "website", "discord", "youtube"] as const;
      const clean: Record<string, string> = {};
      for (const k of keys) {
        const v = raw[k];
        if (typeof v !== "string") continue;
        let s = v.trim().slice(0, 200);
        if (!s) continue;
        // normalizar handles sueltos
        if (k === "github" && !s.includes("/") && !s.startsWith("http")) {
          s = `https://github.com/${s.replace(/^@/, "")}`;
        }
        if (k === "twitter" && !s.includes("/") && !s.startsWith("http")) {
          s = `https://x.com/${s.replace(/^@/, "")}`;
        }
        if (k === "website" && s && !/^https?:\/\//i.test(s)) {
          s = `https://${s}`;
        }
        clean[k] = s;
      }
      await db`
        UPDATE users
        SET connections = ${JSON.stringify(clean)}::jsonb
        WHERE id = ${user.id}
      `;
    }

    const rows = await db`
      SELECT
        id, username, email, password_hash, role, is_vip, banned, created_at,
        display_name, avatar_media_id, banner_media_id, dm_privacy, bio,
        email_verified, deleted_at, connections,
        pgp_public_key, pgp_fingerprint
      FROM users WHERE id = ${user.id} LIMIT 1
    `;
    const pub = toPublicUser(rows[0] as UserRow);
    const r = rows[0] as Record<string, unknown>;
    return NextResponse.json({
      user: {
        ...pub,
        pgp_fingerprint: r.pgp_fingerprint
          ? String(r.pgp_fingerprint)
          : null,
        pgp_public_key: r.pgp_public_key ? String(r.pgp_public_key) : null,
      },
    });
  } catch (e) {
    console.error("[profile PATCH]", e);
    return NextResponse.json(
      { error: "error al guardar perfil" },
      { status: 500 }
    );
  }
}

/** Soft-delete: cuenta programada para borrado en 7 días */
export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    const parsed = await readJsonBody(req, profileDeleteSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const confirm = String(parsed.data.confirm || "");
    if (confirm !== user.username && confirm !== "DELETE") {
      return NextResponse.json(
        {
          error:
            'confirmá con tu username o la palabra DELETE en el campo "confirm"',
        },
        { status: 400 }
      );
    }

    await ensureSchema();
    const db = getDb();
    await db`
      UPDATE users SET deleted_at = NOW() WHERE id = ${user.id}
    `;

    // cerrar sesión
    const { clearSessionCookie } = await import("@/lib/auth");
    await clearSessionCookie();

    return NextResponse.json({
      ok: true,
      message:
        "cuenta programada para eliminación en 7 días. Hacé login antes para restaurarla.",
      days: 7,
    });
  } catch (e) {
    console.error("[profile DELETE]", e);
    return NextResponse.json({ error: "error al eliminar" }, { status: 500 });
  }
}
