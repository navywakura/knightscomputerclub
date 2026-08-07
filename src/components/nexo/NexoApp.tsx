"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/free-solid-svg-icons";
import AppContextMenu, {
  type ContextMenuItem,
} from "@/components/ui/AppContextMenu";
import RankBadge from "@/components/RankBadge";
import CaptchaField from "@/components/CaptchaField";
import VipThemePicker from "@/components/VipThemePicker";
import WiredBootScreen, { WIRED_BOOT_MIN_MS } from "@/components/WiredBootScreen";
import { nexoInviteUrl } from "@/lib/auth-redirect";
import { canCreateNexoBoard, dmUnlockKey, NEXO_POLL_MS } from "@/lib/nexo";
import { apiFetch, getStorage } from "@/lib/platform";
import { getRank, rankNameClass } from "@/lib/ranks";

type Me = {
  id: number;
  username: string;
  role: string;
  is_vip?: boolean;
};

type Board = {
  id: number;
  slug: string;
  name: string;
  description: string;
  owner_id: number;
  owner_name: string;
  message_count: number;
  updated_at: string;
};

type Msg = {
  id: number;
  author_id: number;
  author_name: string;
  author_role?: string;
  author_is_vip?: boolean;
  body: string;
  created_at: string;
};

type DmThread = {
  id: number;
  peer: { id: number; username: string; role?: string; is_vip?: boolean } | null;
  updated_at: string;
};

type Tab = "boards" | "dm";

type Props = {
  /** slug de invitación (?join=) */
  initialJoinSlug?: string | null;
  /** abrir DM por notificación (?dm=threadId) */
  initialDmId?: number | null;
};

export default function NexoApp({
  initialJoinSlug = null,
  initialDmId = null,
}: Props) {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("boards");
  const [boards, setBoards] = useState<Board[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // create board
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [boardCaptchaToken, setBoardCaptchaToken] = useState("");
  const [boardCaptchaAnswer, setBoardCaptchaAnswer] = useState("");
  const [boardCaptchaKey, setBoardCaptchaKey] = useState(0);

  // DM
  const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
  const [dmId, setDmId] = useState<number | null>(null);
  const [dmMessages, setDmMessages] = useState<Msg[]>([]);
  const [dmPeer, setDmPeer] = useState<string>("");
  const [dmPin, setDmPin] = useState("");
  const [dmUnlocked, setDmUnlocked] = useState(false);
  const [dmOpenUser, setDmOpenUser] = useState("");
  const [dmOpenPin, setDmOpenPin] = useState("");
  const [showDmOpen, setShowDmOpen] = useState(false);

  // invitación a tablón
  const [inviteBoard, setInviteBoard] = useState<Board | null>(null);
  const [invitePrompt, setInvitePrompt] = useState(false);
  const [inviteMissing, setInviteMissing] = useState(false);
  const [copyOk, setCopyOk] = useState("");
  const inviteHandled = useRef(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef(0);
  const dmLastIdRef = useRef(0);

  const vip = me ? canCreateNexoBoard(me) : false;

  const scrollBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      const d = await res.json();
      setMe(d.user || null);
    } catch {
      setMe(null);
    }
  }, []);

  const loadBoards = useCallback(async () => {
    try {
      const res = await apiFetch("/api/nexo/boards");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "error");
      setBoards(d.boards || []);
      setCanCreate(Boolean(d.can_create));
    } catch (e) {
      setError(e instanceof Error ? e.message : "error boards");
    }
  }, []);

  const loadMessages = useCallback(
    async (id: number, incremental = false) => {
      try {
        const after = incremental ? lastIdRef.current : 0;
        const q = after
          ? `?board=${id}&after=${after}`
          : `?board=${id}`;
        const res = await apiFetch(`/api/nexo/messages${q}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "error");
        const list = (d.messages || []) as Msg[];
        if (incremental && list.length) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const m of list) {
              if (!ids.has(m.id)) merged.push(m);
            }
            return merged;
          });
          lastIdRef.current = Math.max(
            lastIdRef.current,
            ...list.map((m) => m.id)
          );
          requestAnimationFrame(scrollBottom);
        } else if (!incremental) {
          setMessages(list);
          lastIdRef.current = list.length
            ? list[list.length - 1].id
            : 0;
          requestAnimationFrame(scrollBottom);
        }
      } catch {
        /* poll soft fail */
      }
    },
    [scrollBottom]
  );

  const loadDmList = useCallback(async () => {
    try {
      const res = await apiFetch("/api/nexo/dm");
      const d = await res.json();
      if (res.ok) setDmThreads(d.threads || []);
    } catch {
      /* */
    }
  }, []);

  const loadDmMessages = useCallback(
    async (id: number, incremental = false) => {
      if (!dmUnlocked) return;
      try {
        const after = incremental ? dmLastIdRef.current : 0;
        const q = after
          ? `?thread=${id}&after=${after}`
          : `?thread=${id}`;
        const res = await apiFetch(`/api/nexo/dm${q}`);
        const d = await res.json();
        if (!res.ok) return;
        const list = (d.messages || []) as Msg[];
        if (d.peer) setDmPeer(String(d.peer.username || ""));
        if (incremental && list.length) {
          setDmMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const m of list) {
              if (!ids.has(m.id)) merged.push(m);
            }
            return merged;
          });
          dmLastIdRef.current = Math.max(
            dmLastIdRef.current,
            ...list.map((m) => m.id)
          );
          requestAnimationFrame(scrollBottom);
        } else if (!incremental) {
          setDmMessages(list);
          dmLastIdRef.current = list.length
            ? list[list.length - 1].id
            : 0;
          requestAnimationFrame(scrollBottom);
        }
      } catch {
        /* */
      }
    },
    [dmUnlocked, scrollBottom]
  );

  useEffect(() => {
    document.body.classList.add("nexo-app-active");
    return () => document.body.classList.remove("nexo-app-active");
  }, []);

  useEffect(() => {
    const started =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadMe();
      await loadBoards();
      const elapsed =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        started;
      const wait = Math.max(0, WIRED_BOOT_MIN_MS - elapsed);
      await new Promise((r) => setTimeout(r, wait));
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe, loadBoards]);

  // invitación ?join=slug → prompt Unirse
  useEffect(() => {
    if (loading || inviteHandled.current || !initialJoinSlug) return;
    inviteHandled.current = true;
    const slug = initialJoinSlug.toLowerCase();
    const found =
      boards.find((b) => b.slug.toLowerCase() === slug) || null;
    if (found) {
      setInviteBoard(found);
      setInvitePrompt(true);
      setTab("boards");
    } else {
      setInviteMissing(true);
      setError(`invitación: no se encontró el tablón “${initialJoinSlug}”`);
    }
    // limpiar query de la barra sin recargar
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if (u.searchParams.has("join")) {
        u.searchParams.delete("join");
        window.history.replaceState(null, "", u.pathname + u.search);
      }
    }
  }, [loading, initialJoinSlug, boards]);

  // notificación DM → ?dm=threadId
  useEffect(() => {
    if (loading || !initialDmId) return;
    setTab("dm");
    selectDm(initialDmId);
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if (u.searchParams.has("dm")) {
        u.searchParams.delete("dm");
        window.history.replaceState(null, "", u.pathname + u.search);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialDmId]);

  function acceptInvite() {
    if (inviteBoard) {
      selectBoard(inviteBoard.id);
    }
    setInvitePrompt(false);
    setInviteBoard(null);
  }

  function rejectInvite() {
    setInvitePrompt(false);
    setInviteBoard(null);
  }

  async function copyInviteLink(board: Board) {
    const url = nexoInviteUrl(board.slug);
    try {
      await navigator.clipboard?.writeText(url);
      setCopyOk(`enlace copiado: ${board.name}`);
      window.setTimeout(() => setCopyOk(""), 2500);
    } catch {
      setError(`copiá manualmente: ${url}`);
    }
  }

  // poll board messages
  useEffect(() => {
    if (tab !== "boards" || !boardId) return;
    loadMessages(boardId, false);
    const iv = window.setInterval(
      () => loadMessages(boardId, true),
      NEXO_POLL_MS
    );
    return () => window.clearInterval(iv);
  }, [tab, boardId, loadMessages]);

  // poll DMs
  useEffect(() => {
    if (tab !== "dm") return;
    loadDmList();
    if (dmId && dmUnlocked) {
      loadDmMessages(dmId, false);
      const iv = window.setInterval(
        () => loadDmMessages(dmId, true),
        NEXO_POLL_MS
      );
      return () => window.clearInterval(iv);
    }
  }, [tab, dmId, dmUnlocked, loadDmList, loadDmMessages]);

  async function createBoard(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!vip) {
      setError("crear tablones es exclusivo [VIP]");
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch("/api/nexo/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          captcha_token: boardCaptchaToken,
          captcha_answer: boardCaptchaAnswer,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error al crear");
        setBoardCaptchaKey((k) => k + 1);
        return;
      }
      setNewName("");
      setNewDesc("");
      setBoardCaptchaAnswer("");
      setBoardCaptchaKey((k) => k + 1);
      setShowCreate(false);
      await loadBoards();
      if (d.board?.id) {
        setBoardId(Number(d.board.id));
        lastIdRef.current = 0;
      }
    } catch {
      setError("red caída");
    } finally {
      setSending(false);
    }
  }

  async function sendBoardMsg(e: FormEvent) {
    e.preventDefault();
    if (!boardId || !text.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await apiFetch("/api/nexo/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId, body: text }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error");
        return;
      }
      setText("");
      if (d.message) {
        setMessages((prev) => [...prev, d.message]);
        lastIdRef.current = Math.max(lastIdRef.current, d.message.id);
        requestAnimationFrame(scrollBottom);
      }
    } catch {
      setError("red caída");
    } finally {
      setSending(false);
    }
  }

  async function openDm(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await apiFetch("/api/nexo/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          username: dmOpenUser,
          pin: dmOpenPin,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error");
        return;
      }
      const tid = Number(d.thread_id);
      setDmId(tid);
      setDmPin(dmOpenPin);
      setDmUnlocked(true);
      const st = getStorage();
      st?.setItem(dmUnlockKey(tid), "1");
      setShowDmOpen(false);
      setDmOpenUser("");
      setDmOpenPin("");
      await loadDmList();
    } catch {
      setError("red caída");
    } finally {
      setSending(false);
    }
  }

  async function unlockDm(e: FormEvent) {
    e.preventDefault();
    if (!dmId) return;
    setError("");
    setSending(true);
    try {
      const res = await apiFetch("/api/nexo/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock",
          thread_id: dmId,
          pin: dmPin,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "PIN incorrecto");
        return;
      }
      setDmUnlocked(true);
      getStorage()?.setItem(dmUnlockKey(dmId), "1");
    } catch {
      setError("red caída");
    } finally {
      setSending(false);
    }
  }

  async function sendDm(e: FormEvent) {
    e.preventDefault();
    if (!dmId || !text.trim() || !dmPin) return;
    setSending(true);
    setError("");
    try {
      const res = await apiFetch("/api/nexo/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          thread_id: dmId,
          body: text,
          pin: dmPin,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error");
        return;
      }
      setText("");
      if (d.message) {
        setDmMessages((prev) => [...prev, d.message]);
        dmLastIdRef.current = Math.max(dmLastIdRef.current, d.message.id);
        requestAnimationFrame(scrollBottom);
      }
    } catch {
      setError("red caída");
    } finally {
      setSending(false);
    }
  }

  function selectBoard(id: number) {
    setBoardId(id);
    setMessages([]);
    lastIdRef.current = 0;
    setTab("boards");
  }

  function selectDm(id: number) {
    setDmId(id);
    setDmMessages([]);
    dmLastIdRef.current = 0;
    const unlocked = getStorage()?.getItem(dmUnlockKey(id)) === "1";
    setDmUnlocked(unlocked);
    if (!unlocked) setDmPin("");
    setTab("dm");
  }

  const activeBoard = boards.find((b) => b.id === boardId) || null;
  const chatMsgs = tab === "boards" ? messages : dmMessages;

  const boardCtxFor = (b: Board | null): ContextMenuItem[] => [
    { id: "open", label: "abrir chat" },
    { id: "copy", label: "copiar nombre" },
    {
      id: "invite",
      label: "copiar enlace de invitación",
      disabled: !b,
    },
    { id: "sep1", label: "", separator: true },
    {
      id: "create",
      label: vip ? "crear tablón [VIP]" : "crear tablón (solo VIP)",
      disabled: !vip,
    },
  ];

  const msgCtx: ContextMenuItem[] = [
    { id: "copy_msg", label: "copiar mensaje" },
    { id: "dm_author", label: "DM al autor…" },
  ];

  if (loading) {
    return (
      <div className="nexo-app nexo-loading forum-app-booting">
        <WiredBootScreen
          text="Accediendo a la Wired..."
          label="SERIAL EXPERIMENTS · // NEXO"
          sub="PRESENT DAY · PRESENT TIME"
        />
      </div>
    );
  }

  return (
    <div className="nexo-app" onContextMenu={(e) => e.preventDefault()}>
      <header className="nexo-top">
        <div className="nexo-brand">
          <span className="glow">// NEXO</span>
          <span className="muted"> · realtime boards</span>
        </div>
        <div className="nexo-tabs">
          <button
            type="button"
            className={tab === "boards" ? "on" : ""}
            onClick={() => setTab("boards")}
          >
            boards
          </button>
          <button
            type="button"
            className={tab === "dm" ? "on" : ""}
            onClick={() => {
              setTab("dm");
              loadDmList();
            }}
          >
            DM
          </button>
        </div>
        <div className="nexo-actions">
          <VipThemePicker user={me} />
          {tab === "boards" && (
            <button
              type="button"
              className="btn"
              style={{ fontSize: "0.75rem", padding: "3px 10px" }}
              disabled={!vip}
              title={
                vip
                  ? "crear tablón (VIP)"
                  : "crear tablones es exclusivo [VIP]"
              }
              onClick={() => {
                if (!vip) {
                  setError(
                    "crear tablones en // nexo es exclusivo [VIP]. Ver /donate."
                  );
                  return;
                }
                setShowCreate(true);
              }}
            >
              + board {vip ? "" : "· VIP"}
            </button>
          )}
          {tab === "dm" && (
            <button
              type="button"
              className="btn secondary"
              style={{ fontSize: "0.75rem", padding: "3px 10px" }}
              onClick={() => setShowDmOpen(true)}
            >
              + DM
            </button>
          )}
          {!vip && (
            <Link href="/donate" className="forum-chip">
              [VIP] perks
            </Link>
          )}
        </div>
      </header>

      {copyOk && (
        <div className="form-ok nexo-error" style={{ margin: 0 }}>
          {copyOk}
        </div>
      )}
      {error && (
        <div className="form-error nexo-error">
          {error}{" "}
          <button type="button" className="linkish" onClick={() => setError("")}>
            [x]
          </button>
        </div>
      )}

      <div className="nexo-grid">
        {/* sidebar */}
        <aside className="nexo-side">
          <div className="forum-pane-head">
            {tab === "boards" ? "tablones // nexo" : "mensajes privados"}
          </div>
          <div className="forum-pane-body">
            {tab === "boards" ? (
              <AppContextMenu
                items={boardCtxFor(null)}
                onSelect={(id) => {
                  if (id === "create") {
                    if (vip) setShowCreate(true);
                    else
                      setError(
                        "crear tablones es exclusivo [VIP] — /donate"
                      );
                  }
                }}
              >
                <ul className="nexo-list">
                  {boards.length === 0 ? (
                    <li className="muted forum-pad">
                      sin tablones aún.
                      {vip
                        ? " creá el primero."
                        : " un VIP debe crear el primero."}
                    </li>
                  ) : (
                    boards.map((b) => (
                      <li key={b.id}>
                        <AppContextMenu
                          items={boardCtxFor(b)}
                          onSelect={(id) => {
                            if (id === "open") selectBoard(b.id);
                            if (id === "copy") {
                              void navigator.clipboard?.writeText(b.name);
                            }
                            if (id === "invite") void copyInviteLink(b);
                            if (id === "create" && vip) setShowCreate(true);
                          }}
                        >
                          <button
                            type="button"
                            className={`nexo-list-item${
                              boardId === b.id ? " on" : ""
                            }`}
                            onClick={() => selectBoard(b.id)}
                          >
                            <span className="nexo-list-title">{b.name}</span>
                            <span className="muted nexo-list-meta">
                              @{b.owner_name} · {b.message_count} msg
                            </span>
                          </button>
                        </AppContextMenu>
                      </li>
                    ))
                  )}
                </ul>
              </AppContextMenu>
            ) : (
              <ul className="nexo-list">
                {dmThreads.length === 0 ? (
                  <li className="muted forum-pad">
                    sin DMs. abrí uno con username + PIN de 4 dígitos.
                  </li>
                ) : (
                  dmThreads.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={`nexo-list-item${
                          dmId === t.id ? " on" : ""
                        }`}
                        onClick={() => selectDm(t.id)}
                      >
                        <span className="nexo-list-title">
                          @{t.peer?.username || "?"}
                        </span>
                        <span className="muted nexo-list-meta">
                          <FontAwesomeIcon
                            icon={faLock}
                            className="nexo-lock-icon"
                            aria-hidden
                          />{" "}
                          PIN · {new Date(t.updated_at).toLocaleString()}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </aside>

        {/* chat */}
        <section className="nexo-chat">
          <div className="forum-pane-head">
            {tab === "boards" ? (
              activeBoard ? (
                <span>
                  {activeBoard.name}{" "}
                  <span className="muted">@{activeBoard.owner_name}</span>
                </span>
              ) : (
                <span>elegí un tablón</span>
              )
            ) : dmId ? (
              <span>
                DM · @{dmPeer || "…"}{" "}
                {dmUnlocked ? (
                  <span className="tag ok">unlocked</span>
                ) : (
                  <span className="tag">
                    <FontAwesomeIcon icon={faLock} className="nexo-lock-icon" />{" "}
                    locked
                  </span>
                )}
              </span>
            ) : (
              <span>elegí o abrí un DM</span>
            )}
          </div>

          {tab === "dm" && dmId && !dmUnlocked ? (
            <form className="nexo-pin-form forum-pad" onSubmit={unlockDm}>
              <p className="muted">
                Este DM está protegido. Ingresá el PIN de 4 dígitos que
                acordaron (acordate: no se puede recuperar).
              </p>
              <label htmlFor="nexo-pin">PIN</label>
              <input
                id="nexo-pin"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={dmPin}
                onChange={(e) =>
                  setDmPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="····"
                required
                autoComplete="off"
              />
              <button className="btn" type="submit" disabled={sending}>
                desbloquear
              </button>
            </form>
          ) : (
            <>
              <div className="nexo-messages" ref={scrollerRef}>
                {(tab === "boards" && !boardId) ||
                (tab === "dm" && !dmId) ? (
                  <p className="muted forum-pad">
                    {tab === "boards"
                      ? "seleccioná un board a la izquierda. click derecho = menú de la app."
                      : "seleccioná un DM o creá uno nuevo."}
                  </p>
                ) : chatMsgs.length === 0 ? (
                  <p className="muted forum-pad">sin mensajes. escribí el primero.</p>
                ) : (
                  chatMsgs.map((m) => {
                    const rank = getRank({
                      role: m.author_role,
                      username: m.author_name,
                      is_vip: m.author_is_vip,
                    });
                    const isMine = !!(me && m.author_id === me.id);
                    const initials = (m.author_name || "?")
                      .replace(/^@/, "")
                      .slice(0, 2);
                    return (
                      <AppContextMenu
                        key={m.id}
                        items={msgCtx}
                        onSelect={(id) => {
                          if (id === "copy_msg") {
                            void navigator.clipboard?.writeText(m.body);
                          }
                          if (id === "dm_author") {
                            setTab("dm");
                            setShowDmOpen(true);
                            setDmOpenUser(m.author_name);
                          }
                        }}
                      >
                        <article
                          className={`nexo-msg${isMine ? " mine" : ""}`}
                        >
                          <div className="nexo-msg-avatar" aria-hidden>
                            {initials}
                          </div>
                          <div className="nexo-msg-content">
                            <header className="nexo-msg-meta">
                              <span
                                className={`nexo-msg-user ${rankNameClass(rank) || ""}`.trim()}
                              >
                                @{m.author_name}
                              </span>
                              {rank ? <RankBadge rank={rank} /> : null}
                              <span className="nexo-msg-time">
                                {new Date(m.created_at).toLocaleString()}
                              </span>
                            </header>
                            <div className="nexo-msg-body">{m.body}</div>
                          </div>
                        </article>
                      </AppContextMenu>
                    );
                  })
                )}
              </div>

              {((tab === "boards" && boardId) ||
                (tab === "dm" && dmId && dmUnlocked)) && (
                <form
                  className="nexo-compose"
                  onSubmit={tab === "boards" ? sendBoardMsg : sendDm}
                >
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      tab === "dm"
                        ? "mensaje privado…"
                        : "mensaje al tablón…"
                    }
                    maxLength={4000}
                    disabled={sending}
                    autoComplete="off"
                  />
                  <button
                    className="btn"
                    type="submit"
                    disabled={sending || !text.trim()}
                  >
                    send
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>

      {/* invitación a tablón */}
      {invitePrompt && inviteBoard && (
        <div className="nexo-modal-backdrop" role="presentation">
          <div
            className="nexo-modal"
            role="dialog"
            aria-label="unirse a tablón"
          >
            <h2>invitación</h2>
            <p>
              ¿Unirse a la conversación de{" "}
              <strong>{inviteBoard.name}</strong>?
            </p>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              @{inviteBoard.owner_name}
              {inviteBoard.description
                ? ` · ${inviteBoard.description}`
                : ""}
            </p>
            <div className="compose-toolbar">
              <button type="button" className="btn" onClick={acceptInvite}>
                [ Entrar ]
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={rejectInvite}
              >
                [ Rechazar ]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal crear board — VIP only */}
      {showCreate && (
        <div className="nexo-modal-backdrop" role="presentation">
          <div className="nexo-modal" role="dialog" aria-label="crear tablón">
            <h2>nuevo tablón // nexo</h2>
            {!vip ? (
              <p className="form-error">
                Solo miembros{" "}
                <span className="vip-badge" data-text="[VIP]">
                  [VIP]
                </span>{" "}
                pueden crear boards.{" "}
                <Link href="/donate">donar →</Link>
              </p>
            ) : (
              <form onSubmit={createBoard}>
                <label htmlFor="nb-name">nombre</label>
                <input
                  id="nb-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={64}
                  placeholder="mi-canal"
                />
                <label htmlFor="nb-desc">descripción</label>
                <input
                  id="nb-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  maxLength={400}
                  placeholder="de qué va este nexo"
                />
                <CaptchaField
                  disabled={sending}
                  refreshKey={boardCaptchaKey}
                  onChange={(p) => {
                    setBoardCaptchaToken(p.token);
                    setBoardCaptchaAnswer(p.answer);
                  }}
                />
                <div className="compose-toolbar">
                  <button className="btn" type="submit" disabled={sending}>
                    [ create ]
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setShowCreate(false)}
                  >
                    cancel
                  </button>
                </div>
              </form>
            )}
            {!vip && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowCreate(false)}
              >
                cerrar
              </button>
            )}
          </div>
        </div>
      )}

      {/* modal abrir DM */}
      {showDmOpen && (
        <div className="nexo-modal-backdrop" role="presentation">
          <div className="nexo-modal" role="dialog" aria-label="abrir DM">
            <h2>mensaje privado</h2>
            <p className="muted">
              Elegí un username y un PIN de 4 dígitos. Ambos deben acordarse del
              PIN para leer el chat. No se puede recuperar.
            </p>
            <form onSubmit={openDm}>
              <label htmlFor="dm-user">username</label>
              <input
                id="dm-user"
                value={dmOpenUser}
                onChange={(e) => setDmOpenUser(e.target.value)}
                required
                placeholder="@usuario"
                autoComplete="off"
              />
              <label htmlFor="dm-new-pin">PIN (4 dígitos)</label>
              <input
                id="dm-new-pin"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={dmOpenPin}
                onChange={(e) =>
                  setDmOpenPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                required
                placeholder="1234"
                autoComplete="off"
              />
              <div className="compose-toolbar">
                <button className="btn" type="submit" disabled={sending}>
                  [ open DM ]
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowDmOpen(false)}
                >
                  cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
