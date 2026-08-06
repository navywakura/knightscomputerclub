"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Panel from "@/components/Panel";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "error de login");
        return;
      }
      router.push("/forum");
      router.refresh();
    } catch {
      setError("red caída — reintentá");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="~/auth · login">
      <h1>LOGIN</h1>
      <p className="muted">
        username o email + password. sesión httpOnly, 14 días.
      </p>
      <form onSubmit={onSubmit} style={{ maxWidth: 420 }}>
        {error && <div className="form-error">{error}</div>}
        <label htmlFor="login">login</label>
        <input
          id="login"
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="handle o email"
          required
        />
        <label htmlFor="password">password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "auth…" : "[ entrar ]"}
        </button>
      </form>
      <p style={{ marginTop: 16 }} className="muted">
        ¿sin cuenta?{" "}
        <Link href="/auth/register">registrate en el nodo</Link>
      </p>
    </Panel>
  );
}
