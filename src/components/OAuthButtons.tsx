"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function OAuthButtons() {
  const search = useSearchParams();
  const next = search.get("next");
  const nextQ = next ? `?next=${encodeURIComponent(next)}` : "";

  const [status, setStatus] = useState<{
    google: boolean;
    github: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/oauth/status")
      .then((r) => r.json())
      .then((d) =>
        setStatus({ google: !!d.google, github: !!d.github })
      )
      .catch(() => setStatus({ google: false, github: false }));
  }, []);

  if (!status) {
    return <p className="muted">cargando providers…</p>;
  }

  if (!status.google && !status.github) {
    return (
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        OAuth desactivado — configurá GOOGLE_CLIENT_* / GITHUB_CLIENT_* en
        Vercel para habilitar Google/GitHub.
      </p>
    );
  }

  return (
    <div className="oauth-row">
      {status.google ? (
        <a
          className="btn secondary oauth-btn"
          href={`/api/auth/oauth/google${nextQ}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/google.png"
            alt=""
            width={18}
            height={18}
            className="oauth-btn-icon"
          />
          Google
        </a>
      ) : null}
      {status.github ? (
        <a
          className="btn secondary oauth-btn"
          href={`/api/auth/oauth/github${nextQ}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/github.png"
            alt=""
            width={18}
            height={18}
            className="oauth-btn-icon"
          />
          GitHub
        </a>
      ) : null}
    </div>
  );
}
