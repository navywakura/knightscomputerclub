"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ImageAttach from "@/components/ImageAttach";
import PostBody from "@/components/PostBody";
import RankBadge from "@/components/RankBadge";
import ReplyForm from "@/components/ReplyForm";
import ShareButton from "@/components/ShareButton";
import { getRank, isOwnerUser, rankNameClass, rankPostClass, rankUserClass } from "@/lib/ranks";
import { excerptBody } from "@/lib/markdown";

export type ForumCategory = {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  parent_id: number | null;
  parent_slug: string | null;
  parent_name: string | null;
  thread_count: number;
  child_count: number;
};

type ThreadRow = {
  id: number;
  title: string;
  locked: boolean;
  sticky: boolean;
  created_at: string;
  updated_at: string;
  author_name: string;
  author_role?: string;
  author_is_vip?: boolean;
  post_count: number;
  category_slug?: string;
  category_name?: string;
};

type PostRow = {
  id: number;
  thread_id: number;
  author_id: number;
  body: string;
  created_at: string;
  author_name: string;
  author_role?: string;
  author_is_vip?: boolean;
};

type ThreadDetail = {
  id: number;
  title: string;
  locked: boolean;
  sticky: boolean;
  created_at: string;
  author_id: number;
  author_name: string;
  author_role?: string;
  author_is_vip?: boolean;
  category_slug: string;
  category_name: string;
};

type Me = {
  id: number;
  username: string;
  role: string;
  is_vip?: boolean;
};

export type ForumAppProps = {
  initialBoard?: string | null;
  initialThreadId?: number | null;
  initialMode?: "browse" | "new";
};

type PaneMode = "home" | "board" | "thread" | "new";

export default function ForumApp({
  initialBoard = null,
  initialThreadId = null,
  initialMode = "browse",
}: ForumAppProps) {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [boardSlug, setBoardSlug] = useState<string | null>(
    initialBoard || null
  );
  const [threadId, setThreadId] = useState<number | null>(
    initialThreadId || null
  );
  const [mode, setMode] = useState<PaneMode>(
    initialThreadId
      ? "thread"
      : initialMode === "new"
        ? "new"
        : initialBoard
          ? "board"
          : "home"
  );

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [recent, setRecent] = useState<ThreadRow[]>([]);
  const [me, setMe] = useState<Me | null>(null);

  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState("");

  // new thread form
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCat, setNewCat] = useState(initialBoard || "random");
  const [creating, setCreating] = useState(false);

  // mobile: which column
  const [mobileCol, setMobileCol] = useState<"boards" | "list" | "detail">(
    initialThreadId ? "detail" : "list"
  );

  // lock body scroll / shell to fixed app
  useEffect(() => {
    document.body.classList.add("forum-app-active");
    return () => {
      document.body.classList.remove("forum-app-active");
    };
  }, []);

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const res = await fetch("/api/forum/categories");
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch {
      setError("no se pudieron cargar boards");
    } finally {
      setLoadingCats(false);
    }
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setMe(data.user || null);
    } catch {
      setMe(null);
    }
  }, []);

  const loadThreads = useCallback(async (slug: string | null) => {
    setLoadingThreads(true);
    try {
      const url = slug
        ? `/api/forum/threads?category=${encodeURIComponent(slug)}&limit=80`
        : `/api/forum/threads?limit=24`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      const list = (data.threads || []) as ThreadRow[];
      if (slug) setThreads(list);
      else setRecent(list);
    } catch {
      if (slug) setThreads([]);
      else setRecent([]);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadThread = useCallback(async (id: number) => {
    setLoadingPosts(true);
    setError("");
    try {
      const res = await fetch(`/api/forum/posts?thread=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      setThread(data.thread as ThreadDetail);
      setPosts((data.posts || []) as PostRow[]);
      if (data.thread?.category_slug) {
        setBoardSlug(String(data.thread.category_slug));
      }
    } catch {
      setError("no se pudo cargar el hilo");
      setThread(null);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadMe();
  }, [loadCategories, loadMe]);

  // initial / board changes
  useEffect(() => {
    if (mode === "home") {
      loadThreads(null);
    } else if (mode === "board" && boardSlug) {
      loadThreads(boardSlug);
    }
  }, [mode, boardSlug, loadThreads]);

  useEffect(() => {
    if (mode === "thread" && threadId) {
      loadThread(threadId);
    }
  }, [mode, threadId, loadThread]);

  // sync URL without full remount friction
  useEffect(() => {
    let path = "/forum";
    if (mode === "new") {
      path = newCat ? `/forum/new?cat=${encodeURIComponent(newCat)}` : "/forum/new";
    } else if (mode === "thread" && threadId) {
      path = `/forum/thread/${threadId}`;
    } else if (mode === "board" && boardSlug) {
      path = `/forum/${boardSlug}`;
    }
    if (typeof window !== "undefined" && window.location.pathname + window.location.search !== path) {
      window.history.replaceState(null, "", path);
    }
  }, [mode, boardSlug, threadId, newCat]);

  const postableCategories = useMemo(
    () => categories.filter((c) => Number(c.child_count) === 0),
    [categories]
  );

  const boardTree = useMemo(() => {
    const tops = categories.filter((c) => !c.parent_id);
    return tops.map((parent) => ({
      parent,
      children: categories.filter((c) => c.parent_id === parent.id),
    }));
  }, [categories]);

  const activeBoard = useMemo(
    () => categories.find((c) => c.slug === boardSlug) || null,
    [categories, boardSlug]
  );

  const isHub = activeBoard ? Number(activeBoard.child_count) > 0 : false;

  function selectHome() {
    setMode("home");
    setBoardSlug(null);
    setThreadId(null);
    setThread(null);
    setPosts([]);
    setMobileCol("list");
  }

  function selectBoard(slug: string) {
    const cat = categories.find((c) => c.slug === slug);
    setBoardSlug(slug);
    setThreadId(null);
    setThread(null);
    setPosts([]);
    setNewCat(
      cat && Number(cat.child_count) === 0
        ? slug
        : categories.find(
            (c) => c.parent_id === cat?.id && Number(c.child_count) === 0
          )?.slug || slug
    );
    // hub → show children in list pane; leaf → threads
    setMode("board");
    setMobileCol("list");
  }

  function openThread(id: number) {
    setThreadId(id);
    setMode("thread");
    setMobileCol("detail");
  }

  function openNew(cat?: string) {
    const slug = cat || boardSlug || "random";
    const target = categories.find((c) => c.slug === slug);
    if (target && Number(target.child_count) > 0) {
      const firstChild = categories.find(
        (c) => c.parent_id === target.id && Number(c.child_count) === 0
      );
      setNewCat(firstChild?.slug || "random");
    } else {
      setNewCat(slug);
    }
    setMode("new");
    setThreadId(null);
    setThread(null);
    setPosts([]);
    setMobileCol("detail");
  }

  async function createThread(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newCat,
          title: newTitle,
          body: newBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "error al crear hilo");
        return;
      }
      setNewTitle("");
      setNewBody("");
      setBoardSlug(newCat);
      openThread(Number(data.thread.id));
      loadThreads(newCat);
    } catch {
      setError("red caída");
    } finally {
      setCreating(false);
    }
  }

  async function deleteThread() {
    if (!threadId || !thread) return;
    if (
      !confirm(
        `¿Borrar hilo #${threadId} completo (todos los posts)? Esta acción no se deshace.`
      )
    ) {
      return;
    }
    const res = await fetch("/api/forum/threads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: threadId }),
    });
    if (res.ok) {
      const slug = thread.category_slug;
      selectBoard(slug);
      loadThreads(slug);
    }
  }

  async function deletePost(postId: number) {
    if (!confirm(`¿Borrar post #${postId}?`)) return;
    const res = await fetch("/api/forum/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "error al borrar");
      return;
    }
    if (data.thread_deleted) {
      if (boardSlug) selectBoard(boardSlug);
      else selectHome();
      return;
    }
    if (threadId) loadThread(threadId);
  }

  const listTitle =
    mode === "home"
      ? "recent"
      : activeBoard
        ? activeBoard.name
        : boardSlug || "board";

  const hubChildren =
    isHub && activeBoard
      ? categories.filter((c) => c.parent_id === activeBoard.id)
      : [];

  const listRows: ThreadRow[] =
    mode === "home" ? recent : mode === "board" && !isHub ? threads : [];

  return (
    <div className="forum-app">
      <div className="forum-app-top">
        <div className="forum-app-brand">
          <span className="glow">FORO</span>
          <span className="muted"> · app</span>
        </div>
        <div className="forum-app-actions">
          <button
            type="button"
            className={`forum-chip${mode === "home" ? " on" : ""}`}
            onClick={selectHome}
          >
            overview
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontSize: "0.75rem", padding: "3px 10px" }}
            onClick={() => openNew()}
            disabled={!me}
            title={me ? "nuevo hilo" : "login requerido"}
          >
            + thread
          </button>
          {!me && (
            <Link href="/auth/login" className="forum-chip">
              login
            </Link>
          )}
        </div>
      </div>

      <div className="forum-app-mobile-tabs">
        <button
          type="button"
          className={mobileCol === "boards" ? "on" : ""}
          onClick={() => setMobileCol("boards")}
        >
          boards
        </button>
        <button
          type="button"
          className={mobileCol === "list" ? "on" : ""}
          onClick={() => setMobileCol("list")}
        >
          list
        </button>
        <button
          type="button"
          className={mobileCol === "detail" ? "on" : ""}
          onClick={() => setMobileCol("detail")}
        >
          view
        </button>
      </div>

      <div className="forum-app-grid">
        {/* ── boards rail ── */}
        <aside
          className={`forum-pane forum-boards${mobileCol === "boards" ? " show-mobile" : ""}`}
        >
          <div className="forum-pane-head">boards</div>
          <div className="forum-pane-body">
            {loadingCats ? (
              <p className="muted forum-pad">cargando…</p>
            ) : (
              <nav className="forum-board-nav">
                <button
                  type="button"
                  className={`forum-board-item root${mode === "home" ? " active" : ""}`}
                  onClick={selectHome}
                >
                  <span className="bn">// overview</span>
                  <span className="bc muted">todo</span>
                </button>
                {boardTree.map(({ parent, children }) => (
                  <div key={parent.id} className="forum-board-group">
                    <button
                      type="button"
                      className={`forum-board-item root${
                        boardSlug === parent.slug && mode !== "home"
                          ? " active"
                          : ""
                      }`}
                      onClick={() => selectBoard(parent.slug)}
                    >
                      <span className="bn">{parent.name}</span>
                      <span className="bc">
                        {children.length > 0
                          ? `${children.length} sub`
                          : parent.thread_count}
                      </span>
                    </button>
                    {children.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        className={`forum-board-item child${
                          boardSlug === ch.slug ? " active" : ""
                        }`}
                        onClick={() => selectBoard(ch.slug)}
                      >
                        <span className="bn">{ch.name}</span>
                        <span className="bc">{ch.thread_count}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            )}
          </div>
        </aside>

        {/* ── thread list ── */}
        <section
          className={`forum-pane forum-list${mobileCol === "list" ? " show-mobile" : ""}`}
        >
          <div className="forum-pane-head">
            <span>{listTitle}</span>
            {mode === "board" && boardSlug && !isHub && me && (
              <button
                type="button"
                className="forum-mini-btn"
                onClick={() => openNew(boardSlug)}
              >
                + new
              </button>
            )}
          </div>
          <div className="forum-pane-body">
            {activeBoard && (
              <p className="forum-board-desc muted">{activeBoard.description}</p>
            )}

            {mode === "board" && isHub && (
              <div className="forum-hub-grid">
                {hubChildren.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className="forum-hub-card"
                    onClick={() => selectBoard(ch.slug)}
                  >
                    <strong>{ch.name}</strong>
                    <span className="muted">{ch.description}</span>
                    <span className="tag">{ch.thread_count} threads</span>
                  </button>
                ))}
              </div>
            )}

            {loadingThreads && (mode === "home" || (mode === "board" && !isHub)) ? (
              <p className="muted forum-pad">cargando hilos…</p>
            ) : null}

            {!loadingThreads &&
              (mode === "home" || (mode === "board" && !isHub)) &&
              listRows.length === 0 && (
                <p className="muted forum-pad">
                  board vacío.{" "}
                  {me && boardSlug && !isHub ? (
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => openNew(boardSlug)}
                    >
                      abrí el primer hilo
                    </button>
                  ) : (
                    "nada reciente."
                  )}
                </p>
              )}

            <ul className="forum-thread-list">
              {listRows.map((t) => {
                const rank = getRank({
                  role: String(t.author_role || ""),
                  username: String(t.author_name || ""),
                  is_vip: Boolean(t.author_is_vip),
                });
                const active = threadId === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={`forum-thread-item${active ? " active" : ""}`}
                      onClick={() => openThread(t.id)}
                    >
                      <div className="ft-title">
                        {t.sticky ? <span className="tag hot">sticky</span> : null}
                        {t.locked ? <span className="tag">locked</span> : null}
                        {t.title}
                      </div>
                      <div className="ft-meta muted">
                        <span className={rankNameClass(rank)}>
                          @{t.author_name}
                        </span>
                        {mode === "home" && t.category_slug ? (
                          <>
                            {" · "}
                            <span>{t.category_name || t.category_slug}</span>
                          </>
                        ) : null}
                        {" · "}
                        {t.post_count} posts ·{" "}
                        {new Date(t.updated_at).toLocaleString()}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── detail ── */}
        <section
          className={`forum-pane forum-detail${mobileCol === "detail" ? " show-mobile" : ""}`}
        >
          <div className="forum-pane-head">
            {mode === "thread" && thread ? (
              <>
                <span className="forum-detail-title" title={thread.title}>
                  {thread.title}
                </span>
                <div className="forum-detail-tools">
                  {boardSlug && (
                    <button
                      type="button"
                      className="forum-mini-btn"
                      onClick={() => selectBoard(boardSlug)}
                    >
                      ← board
                    </button>
                  )}
                  {me &&
                  (isOwnerUser(me) || me.id === Number(thread.author_id)) ? (
                    <button
                      type="button"
                      className="forum-mini-btn danger"
                      onClick={deleteThread}
                    >
                      del
                    </button>
                  ) : null}
                </div>
              </>
            ) : mode === "new" ? (
              <span>new thread</span>
            ) : (
              <span>preview</span>
            )}
          </div>

          <div className="forum-pane-body forum-detail-body">
            {error && <div className="form-error forum-pad">{error}</div>}

            {mode === "home" && (
              <div className="forum-pad forum-welcome">
                <h1 className="forum-h1">FORO DEL NODO</h1>
                <p className="muted">
                  elegí un board a la izquierda. sin likes. sin feed
                  algorítmico. solo texto. offtopic sin NSFW.
                </p>
                <div className="forum-quick">
                  {postableCategories.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="forum-chip"
                      onClick={() => selectBoard(c.slug)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "board" && activeBoard && !threadId && (
              <div className="forum-pad forum-welcome">
                <h2 className="forum-h1">{activeBoard.name}</h2>
                <p className="muted">{activeBoard.description}</p>
                {isHub ? (
                  <p className="muted">
                    abrí una subcategoría en el panel del medio.
                  </p>
                ) : me ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => openNew(activeBoard.slug)}
                  >
                    [ + new thread ]
                  </button>
                ) : (
                  <p className="muted">
                    <Link href="/auth/login">login</Link> para publicar.
                  </p>
                )}
              </div>
            )}

            {mode === "new" && (
              <div className="forum-pad">
                {!me ? (
                  <div className="form-error">
                    login requerido.{" "}
                    <Link href="/auth/login">entrar</Link> o{" "}
                    <Link href="/auth/register">registrarte</Link>.
                  </div>
                ) : (
                  <form onSubmit={createThread} className="forum-compose">
                    <label htmlFor="fa-cat">board</label>
                    <select
                      id="fa-cat"
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                    >
                      {boardTree.map(({ parent, children }) =>
                        children.length === 0 ? (
                          <option key={parent.id} value={parent.slug}>
                            {parent.name}
                          </option>
                        ) : (
                          <optgroup key={parent.id} label={parent.name}>
                            {children.map((ch) => (
                              <option key={ch.id} value={ch.slug}>
                                {ch.name}
                              </option>
                            ))}
                          </optgroup>
                        )
                      )}
                    </select>
                    <label htmlFor="fa-title">title</label>
                    <input
                      id="fa-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      minLength={3}
                      maxLength={200}
                      placeholder="asunto del hilo"
                    />
                    <label htmlFor="fa-body">body</label>
                    <textarea
                      id="fa-body"
                      value={newBody}
                      onChange={(e) => setNewBody(e.target.value)}
                      required
                      minLength={3}
                      maxLength={20000}
                      placeholder={
                        "primer mensaje (markdown OK)\n\n**bold** · `code` · [link](https://…)"
                      }
                    />
                    <div className="compose-toolbar">
                      <ImageAttach
                        disabled={creating}
                        onInsert={(md) =>
                          setNewBody((b) => (b ? b + md : md.trim() + "\n"))
                        }
                      />
                      <button className="btn" type="submit" disabled={creating}>
                        {creating ? "creando…" : "[ create thread ]"}
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          boardSlug ? selectBoard(boardSlug) : selectHome()
                        }
                      >
                        cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {mode === "thread" && loadingPosts && (
              <p className="muted forum-pad">cargando posts…</p>
            )}

            {mode === "thread" && !loadingPosts && thread && (
              <div className="forum-posts">
                <div className="forum-thread-meta muted forum-pad">
                  by{" "}
                  <span
                    className={rankNameClass(
                      getRank({
                        role: String(thread.author_role || ""),
                        username: String(thread.author_name || ""),
                        is_vip: Boolean(thread.author_is_vip),
                      })
                    )}
                  >
                    @{thread.author_name}
                  </span>{" "}
                  · {new Date(thread.created_at).toLocaleString()}
                  {thread.locked ? " · LOCKED" : ""}
                  {" · "}
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => selectBoard(thread.category_slug)}
                  >
                    {thread.category_name}
                  </button>
                </div>

                {posts.map((p, i) => {
                  const rank = getRank({
                    role: String(p.author_role || ""),
                    username: String(p.author_name || ""),
                    is_vip: Boolean(p.author_is_vip),
                  });
                  const userCls = rankUserClass(rank);
                  const postCls = rankPostClass(rank);
                  const canDel =
                    me &&
                    (isOwnerUser(me) || me.id === Number(p.author_id));
                  return (
                    <article
                      key={p.id}
                      id={`post-${p.id}`}
                      className={`post${postCls ? ` ${postCls}` : ""}`}
                    >
                      <div className="post-meta">
                        <span>
                          #{i + 1}{" "}
                          <span className={`user${userCls ? ` ${userCls}` : ""}`}>
                            @{p.author_name}
                          </span>
                          {rank ? (
                            <>
                              {" "}
                              <RankBadge rank={rank} />
                            </>
                          ) : null}
                        </span>
                        <span className="role">{String(p.author_role)}</span>
                        <span>
                          {new Date(p.created_at).toLocaleString()}
                        </span>
                        <ShareButton
                          path={`/forum/post/${p.id}`}
                          title={thread.title}
                          text={excerptBody(p.body, 120)}
                        />
                        {canDel ? (
                          <button
                            type="button"
                            className="mod-btn danger"
                            onClick={() => deletePost(p.id)}
                          >
                            [del]
                          </button>
                        ) : null}
                      </div>
                      <PostBody
                        body={p.body}
                        mode={i === 0 ? "markdown" : "plain"}
                        previews={[]}
                      />
                    </article>
                  );
                })}

                {!thread.locked && (
                  <div className="forum-reply-box">
                    <div className="forum-pane-head">reply</div>
                    {me ? (
                      <div className="forum-pad">
                        <ReplyForm
                          threadId={thread.id}
                          onPosted={() => loadThread(thread.id)}
                        />
                      </div>
                    ) : (
                      <p className="muted forum-pad">
                        <Link href="/auth/login">login</Link> o{" "}
                        <Link href="/auth/register">register</Link> para
                        responder.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
