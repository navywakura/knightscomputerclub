"use client";

import { useCallback, useEffect, useState } from "react";

type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  is_vip: boolean;
  banned: boolean;
  created_at: string;
};

type ReportRow = {
  id: number;
  reporter_id: number;
  reporter_name?: string;
  target_type: string;
  target_id: number;
  reason: string;
  details: string;
  status: string;
  created_at: string;
};

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [postId, setPostId] = useState("");
  const [threadId, setThreadId] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "no autorizado");
        setUsers([]);
        return;
      }
      setUsers(data.users || []);
    } catch {
      setError("error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      if (res.ok) setReports(data.reports || []);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    load();
    loadReports();
  }, [load, loadReports]);

  async function setReportStatus(id: number, status: string) {
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "error reporte");
        return;
      }
      setMsg(`reporte #${id} → ${status}`);
      await loadReports();
    } catch {
      setError("red caída");
    }
  }

  async function act(user: AdminUser, action: string) {
    setBusyId(user.id);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "falló la acción");
        return;
      }
      setMsg(`${action} → @${data.user.username}`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function deletePost(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(postId);
    if (!id) return;
    if (!confirm(`¿Borrar post #${id}?`)) return;
    setMsg("");
    setError("");
    const res = await fetch("/api/forum/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "error al borrar post");
      return;
    }
    setMsg(
      data.thread_deleted
        ? `post #${id} borrado · hilo vacío eliminado`
        : `post #${id} borrado`
    );
    setPostId("");
  }

  async function deleteThread(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(threadId);
    if (!id) return;
    if (!confirm(`¿Borrar hilo #${id} y todos sus posts?`)) return;
    setMsg("");
    setError("");
    const res = await fetch("/api/forum/threads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "error al borrar hilo");
      return;
    }
    setMsg(`hilo #${id} borrado`);
    setThreadId("");
  }

  if (loading) {
    return <p className="muted">cargando panel…</p>;
  }

  return (
    <div className="admin-panel">
      {error ? <div className="form-error">{error}</div> : null}
      {msg ? <div className="form-ok">{msg}</div> : null}

      <section className="admin-section">
        <h2>reportes</h2>
        <p className="muted">
          Moderación de reportes de foro, nexo y DMs. open → reviewed /
          dismissed.
        </p>
        {reports.length === 0 ? (
          <p className="muted">sin reportes</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="forum-table admin-table">
              <thead>
                <tr>
                  <th>id</th>
                  <th>quién</th>
                  <th>target</th>
                  <th>motivo</th>
                  <th>status</th>
                  <th>acciones</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>@{r.reporter_name || r.reporter_id}</td>
                    <td>
                      <code>
                        {r.target_type}#{r.target_id}
                      </code>
                      {r.details ? (
                        <div className="muted" style={{ fontSize: "0.75rem" }}>
                          {r.details.slice(0, 80)}
                        </div>
                      ) : null}
                    </td>
                    <td>{r.reason}</td>
                    <td>
                      <span
                        className={`tag${r.status === "open" ? " hot" : ""}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="admin-actions">
                      {r.status === "open" ? (
                        <>
                          <button
                            type="button"
                            className="mod-btn"
                            onClick={() =>
                              void setReportStatus(r.id, "reviewed")
                            }
                          >
                            reviewed
                          </button>
                          <button
                            type="button"
                            className="mod-btn"
                            onClick={() =>
                              void setReportStatus(r.id, "dismissed")
                            }
                          >
                            dismiss
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="mod-btn"
                          onClick={() => void setReportStatus(r.id, "open")}
                        >
                          reopen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="btn secondary" onClick={loadReports}>
          [ refresh reportes ]
        </button>
      </section>

      <section className="admin-section">
        <h2>borrar por id</h2>
        <p className="muted">
          También podés usar [del] en cada post del hilo si estás logueado como
          owner.
        </p>
        <form className="admin-inline-form" onSubmit={deletePost}>
          <label>
            post id
            <input
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              inputMode="numeric"
              placeholder="42"
            />
          </label>
          <button type="submit" className="btn danger">
            [ borrar post ]
          </button>
        </form>
        <form className="admin-inline-form" onSubmit={deleteThread}>
          <label>
            thread id
            <input
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              inputMode="numeric"
              placeholder="7"
            />
          </label>
          <button type="submit" className="btn danger">
            [ borrar hilo ]
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2>usuarios</h2>
        <p className="muted">
          ban = no login / sin sesión · vip = badge [VIP] · no se puede banear
          owner
        </p>
        {users.length === 0 ? (
          <p className="muted">sin usuarios</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="forum-table admin-table">
              <thead>
                <tr>
                  <th>id</th>
                  <th>user</th>
                  <th>email</th>
                  <th>role</th>
                  <th>flags</th>
                  <th>acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const busy = busyId === u.id;
                  return (
                    <tr
                      key={u.id}
                      className={u.banned ? "admin-row-banned" : undefined}
                    >
                      <td>{u.id}</td>
                      <td>@{u.username}</td>
                      <td className="muted" style={{ fontSize: "0.8rem" }}>
                        {u.email}
                      </td>
                      <td>{u.role}</td>
                      <td>
                        {u.is_vip ? (
                          <span className="tag hot">VIP</span>
                        ) : null}{" "}
                        {u.banned ? (
                          <span className="tag" style={{ color: "#ff6666" }}>
                            BANNED
                          </span>
                        ) : (
                          <span className="tag ok">ok</span>
                        )}
                      </td>
                      <td className="admin-actions">
                        {u.banned ? (
                          <button
                            type="button"
                            className="mod-btn"
                            disabled={busy}
                            onClick={() => act(u, "unban")}
                          >
                            unban
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="mod-btn danger"
                            disabled={busy || u.role === "owner"}
                            onClick={() => act(u, "ban")}
                          >
                            ban
                          </button>
                        )}
                        {u.is_vip ? (
                          <button
                            type="button"
                            className="mod-btn"
                            disabled={busy}
                            onClick={() => act(u, "unvip")}
                          >
                            −vip
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="mod-btn"
                            disabled={busy}
                            onClick={() => act(u, "vip")}
                          >
                            +vip
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="btn secondary" onClick={load}>
          [ refresh ]
        </button>
      </section>
    </div>
  );
}
