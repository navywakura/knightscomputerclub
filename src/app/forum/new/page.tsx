"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Panel from "@/components/Panel";
import ImageAttach from "@/components/ImageAttach";

type Cat = { slug: string; name: string };

function NewThreadForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [categories, setCategories] = useState<Cat[]>([]);
  const [category, setCategory] = useState(search.get("cat") || "general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.user))
      .catch(() => setAuthed(false));
    fetch("/api/forum/categories")
      .then((r) => r.json())
      .then((d) => {
        if (d.categories) {
          setCategories(
            d.categories.map((c: { slug: string; name: string }) => ({
              slug: c.slug,
              name: c.name,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "error al crear hilo");
        return;
      }
      router.push(`/forum/thread/${data.thread.id}`);
      router.refresh();
    } catch {
      setError("red caída");
    } finally {
      setLoading(false);
    }
  }

  if (authed === false) {
    return (
      <Panel title="~/forum · new">
        <div className="form-error">
          login requerido.{" "}
          <Link href="/auth/login">entrar</Link> o{" "}
          <Link href="/auth/register">registrarte</Link>.
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="~/forum · new_thread">
      <h1>NUEVO HILO</h1>
      <p className="muted">
        señal &gt; ruido. título claro, body con contexto.{" "}
        <strong>Markdown</strong> soportado en el primer post (GFM: **negrita**,
        listas, código, links, imágenes). Los replies van en texto plano +
        embeds de links.
      </p>
      <form onSubmit={onSubmit}>
        {error && <div className="form-error">{error}</div>}
        <label htmlFor="category">board</label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {(categories.length
            ? categories
            : [
                { slug: "general", name: "// general" },
                { slug: "rxos", name: "// rxos-dev" },
                { slug: "debate", name: "// debate" },
                { slug: "ops", name: "// ops-infra" },
              ]
          ).map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <label htmlFor="title">title</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={200}
          placeholder="asunto del hilo"
        />
        <label htmlFor="body">body</label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={3}
          maxLength={20000}
          placeholder={"primer mensaje (markdown OK)\n\n**bold** · `code` · [link](https://…)\n![img](/api/media/…)"}
        />
        <div className="compose-toolbar">
          <ImageAttach
            disabled={loading}
            onInsert={(md) => setBody((b) => (b ? b + md : md.trim() + "\n"))}
          />
          <button
            className="btn"
            type="submit"
            disabled={loading || authed === null}
          >
            {loading ? "creando…" : "[ create thread ]"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

export default function NewThreadPage() {
  return (
    <Suspense
      fallback={
        <Panel title="~/forum · new">
          <p className="muted">cargando…</p>
        </Panel>
      }
    >
      <NewThreadForm />
    </Suspense>
  );
}
