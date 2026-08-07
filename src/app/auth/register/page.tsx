"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import Panel from "@/components/Panel";
import OAuthButtons from "@/components/OAuthButtons";

function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const nextRaw = search.get("next");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "error de registro");
        return;
      }
      let dest = "/forum";
      if (nextRaw) {
        const { safeInternalPath } = await import("@/lib/auth-redirect");
        dest = safeInternalPath(nextRaw, "/forum");
      }
      router.push(dest);
      router.refresh();
    } catch {
      setError("red caída — reintentá");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="~/auth · register">
      <h1>NUEVO HANDLE</h1>
      <p className="muted">
        username 3–32 · a-z 0-9 _ - · password ≥ 8 · sin verificación de
        email (aún)
      </p>
      <div style={{ maxWidth: 420, marginBottom: 16 }}>
        <p className="muted" style={{ marginBottom: 8 }}>
          o registrate con:
        </p>
        <OAuthButtons />
      </div>
      <hr className="hr" />
      <form onSubmit={onSubmit} style={{ maxWidth: 420 }}>
        {error && <div className="form-error">{error}</div>}
        <label htmlFor="username">username</label>
        <input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ej: rootkit_girl"
          required
          minLength={3}
          maxLength={32}
        />
        <label htmlFor="email">email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="no se vende a nadie"
          required
        />
        <label htmlFor="password">password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "creando…" : "[ crear cuenta ]"}
        </button>
      </form>
      <p style={{ marginTop: 16 }} className="muted">
        ¿ya tenés cuenta?{" "}
        <Link
          href={
            nextRaw
              ? `/auth/login?next=${encodeURIComponent(nextRaw)}`
              : "/auth/login"
          }
        >
          login
        </Link>
      </p>
    </Panel>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <Panel title="~/auth · register">
          <p className="muted">cargando…</p>
        </Panel>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
