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
import NexoChatBody from "@/components/nexo/NexoChatBody";
import NexoEmojiPicker from "@/components/nexo/NexoEmojiPicker";
import NexoFileAttach from "@/components/nexo/NexoFileAttach";
import NexoGifPicker from "@/components/nexo/NexoGifPicker";
import VipThemePicker from "@/components/VipThemePicker";
import WiredBootScreen, { WIRED_BOOT_MIN_MS } from "@/components/WiredBootScreen";
import { nexoInviteUrl } from "@/lib/auth-redirect";
import {
  canCreateNexoBoard,
  canEditMessageByAge,
  dmUnlockKey,
  NEXO_GROUP_MS,
  NEXO_POLL_HIDDEN_MS,
  NEXO_POLL_MS,
  slugifyBoardName,
} from "@/lib/nexo";
import { parseNexoCommand } from "@/lib/nexo-commands";
import { apiFetch, getStorage } from "@/lib/platform";
import { useIsPhone } from "@/lib/use-phone";
import { getRank, rankNameClass } from "@/lib/ranks";
import { playUiSfx } from "@/lib/ui-sfx";
import { useRouter } from "next/navigation";

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
  owner_is_vip?: boolean;
  owner_role?: string;
  message_count: number;
  updated_at: string;
};

type BoardMember = {
  id: number;
  username: string;
  display_name: string | null;
  role: string;
  is_vip: boolean;
  online: boolean;
};

type FriendUser = {
  friendship_id: number;
  id: number;
  username: string;
  display_name: string | null;
  role: string;
  is_vip: boolean;
  avatar_url: string | null;
};

type Msg = {
  id: number;
  author_id: number;
  author_name: string;
  author_display_name?: string | null;
  author_role?: string;
  author_is_vip?: boolean;
  author_avatar_url?: string | null;
  body: string;
  created_at: string;
  edited_at?: string | null;
  deleted?: boolean;
  expires_at?: string | null;
};

type DmThread = {
  id: number;
  peer: { id: number; username: string; role?: string; is_vip?: boolean } | null;
  updated_at: string;
};

type Tab = "boards" | "dm" | "friends";

type Props = {
  /** slug de invitación (?join=) */
  initialJoinSlug?: string | null;
  /** abrir DM por notificación (?dm=threadId) */
  initialDmId?: number | null;
  /** abrir board por id (?board=) */
  initialBoardId?: number | null;
  /** abrir board por slug (?board=mi-canal) */
  initialBoardSlug?: string | null;
  /** prefill DM open (?dm_user=) */
  initialDmUser?: string | null;
};

export default function NexoApp({
  initialJoinSlug = null,
  initialDmId = null,
  initialBoardId = null,
  initialBoardSlug = null,
  initialDmUser = null,
}: Props) {
  const isPhone = useIsPhone();
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("boards");
  /** en teléfono: lista | chat | miembros */
  const [mobilePane, setMobilePane] = useState<"list" | "chat" | "members">(
    "list"
  );
  const [boards, setBoards] = useState<Board[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // friends
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<FriendUser[]>([]);
  const [outgoing, setOutgoing] = useState<FriendUser[]>([]);
  const [friendUser, setFriendUser] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [dmEphemeral, setDmEphemeral] = useState(0);
  const serverTimeRef = useRef<string | null>(null);
  const router = useRouter();

  // create board (flujo simple: nombre → listo)
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [boardCaptchaToken, setBoardCaptchaToken] = useState("");
  const [boardCaptchaAnswer, setBoardCaptchaAnswer] = useState("");
  const [boardCaptchaKey, setBoardCaptchaKey] = useState(0);
  const [createOk, setCreateOk] = useState<{
    name: string;
    boardId: number;
    forumPath: string | null;
  } | null>(null);

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
  const boardDeepLinkHandled = useRef(false);

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
        const params = new URLSearchParams({ board: String(id) });
        if (after) {
          params.set("after", String(after));
          if (serverTimeRef.current) {
            params.set("since", serverTimeRef.current);
          }
        }
        const res = await apiFetch(`/api/nexo/messages?${params}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "error");
        if (d.server_time) serverTimeRef.current = String(d.server_time);
        const list = (d.messages || []) as Msg[];
        const updates = (d.updates || []) as Msg[];
        if (incremental) {
          setMessages((prev) => {
            let next = [...prev];
            if (updates.length) {
              const byId = new Map(updates.map((u) => [u.id, u]));
              next = next.map((m) => byId.get(m.id) || m);
            }
            if (list.length) {
              const ids = new Set(next.map((m) => m.id));
              for (const m of list) {
                if (!ids.has(m.id)) next.push(m);
              }
              lastIdRef.current = Math.max(
                lastIdRef.current,
                ...list.map((m) => m.id)
              );
              requestAnimationFrame(scrollBottom);
            }
            return next;
          });
        } else {
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

  const loadFriends = useCallback(async () => {
    try {
      const res = await apiFetch("/api/friends");
      const d = await res.json();
      if (!res.ok) return;
      setFriends(d.friends || []);
      setIncoming(d.incoming || []);
      setOutgoing(d.outgoing || []);
    } catch {
      /* */
    }
  }, []);

  const joinBoard = useCallback(async (id: number) => {
    try {
      await apiFetch("/api/nexo/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: id }),
      });
    } catch {
      /* */
    }
  }, []);

  const loadMembers = useCallback(async (id: number) => {
    try {
      const res = await apiFetch(`/api/nexo/members?board=${id}`);
      const d = await res.json();
      if (res.ok) setMembers(d.members || []);
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
      await Promise.all([loadBoards(), loadFriends()]);
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
  }, [loadMe, loadBoards, loadFriends]);

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

  // ?board=id o ?board=slug (una sola vez)
  useEffect(() => {
    if (loading || boardDeepLinkHandled.current) return;
    if (!initialBoardId && !initialBoardSlug) return;
    if (initialBoardSlug && boards.length === 0) return; // esperar lista

    boardDeepLinkHandled.current = true;
    if (initialBoardId) {
      selectBoard(initialBoardId);
    } else if (initialBoardSlug) {
      const found = boards.find(
        (b) => b.slug.toLowerCase() === initialBoardSlug.toLowerCase()
      );
      if (found) selectBoard(found.id);
      else
        setError(
          `no se encontró el tablón “${initialBoardSlug}”. ¿existe aún?`
        );
    }
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if (u.searchParams.has("board")) {
        u.searchParams.delete("board");
        window.history.replaceState(null, "", u.pathname + u.search);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialBoardId, initialBoardSlug, boards]);

  // ?dm_user= → abrir modal DM
  useEffect(() => {
    if (loading || !initialDmUser) return;
    setTab("dm");
    setShowDmOpen(true);
    setDmOpenUser(initialDmUser);
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if (u.searchParams.has("dm_user")) {
        u.searchParams.delete("dm_user");
        window.history.replaceState(null, "", u.pathname + u.search);
      }
    }
  }, [loading, initialDmUser]);

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

  // poll board messages + members (menos agresivo en background)
  useEffect(() => {
    if (tab !== "boards" || !boardId) return;
    void joinBoard(boardId);
    loadMessages(boardId, false);
    void loadMembers(boardId);
    let tick = 0;
    const tickFn = () => {
      loadMessages(boardId, true);
      tick += 1;
      // heartbeat miembros cada ~4 polls
      if (tick % 4 === 0) {
        void joinBoard(boardId);
        void loadMembers(boardId);
      }
    };
    let iv = window.setInterval(
      tickFn,
      document.visibilityState === "visible" ? NEXO_POLL_MS : NEXO_POLL_HIDDEN_MS
    );
    const onVis = () => {
      window.clearInterval(iv);
      iv = window.setInterval(
        tickFn,
        document.visibilityState === "visible"
          ? NEXO_POLL_MS
          : NEXO_POLL_HIDDEN_MS
      );
      if (document.visibilityState === "visible") tickFn();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tab, boardId, loadMessages, joinBoard, loadMembers]);

  // poll DMs
  useEffect(() => {
    if (tab !== "dm") return;
    loadDmList();
    if (dmId && dmUnlocked) {
      loadDmMessages(dmId, false);
      let iv = window.setInterval(
        () => loadDmMessages(dmId, true),
        document.visibilityState === "visible"
          ? NEXO_POLL_MS
          : NEXO_POLL_HIDDEN_MS
      );
      const onVis = () => {
        window.clearInterval(iv);
        iv = window.setInterval(
          () => loadDmMessages(dmId, true),
          document.visibilityState === "visible"
            ? NEXO_POLL_MS
            : NEXO_POLL_HIDDEN_MS
        );
      };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        window.clearInterval(iv);
        document.removeEventListener("visibilitychange", onVis);
      };
    }
  }, [tab, dmId, dmUnlocked, loadDmList, loadDmMessages]);

  // friends list
  useEffect(() => {
    if (tab !== "friends") return;
    void loadFriends();
    const iv = window.setInterval(() => void loadFriends(), 15000);
    return () => window.clearInterval(iv);
  }, [tab, loadFriends]);

  async function createBoard(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCreateOk(null);
    if (!vip) {
      setError("crear tablones es exclusivo [VIP]");
      return;
    }
    const name = newName.trim();
    if (name.length < 2) {
      setError("poné un nombre (mín. 2 letras)");
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch("/api/nexo/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newDesc.trim(),
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
      const forumPath =
        (d.forum?.path as string | null) ||
        (d.board?.slug ? `/forum/${d.board.slug}` : null);
      setCreateOk({
        name: String(d.board?.name || name),
        boardId: Number(d.board?.id || 0),
        forumPath,
      });
      setNewName("");
      setNewDesc("");
      setBoardCaptchaAnswer("");
      setBoardCaptchaKey((k) => k + 1);
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

    // comandos IRC locales
    const cmd = parseNexoCommand(text, me?.username);
    if (cmd) {
      if (cmd.type === "help" || cmd.type === "error") {
        setError(cmd.text);
        setText("");
        return;
      }
      if (cmd.type === "clear") {
        setMessages([]);
        lastIdRef.current = 0;
        setText("");
        return;
      }
      if (cmd.type === "theme") {
        if (cmd.theme === "default") {
          document.body.removeAttribute("data-forum-theme");
        } else {
          document.body.setAttribute("data-forum-theme", cmd.theme);
        }
        try {
          localStorage.setItem("kc_forum_theme", cmd.theme);
        } catch {
          /* */
        }
        setText("");
        playUiSfx("click");
        return;
      }
      if (cmd.type === "message") {
        // enviar mensaje transformado (/me, /shrug…)
        setText(cmd.body);
        // fall through with transformed body
        const body = cmd.body;
        setSending(true);
        setError("");
        try {
          const res = await apiFetch("/api/nexo/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_id: boardId, body }),
          });
          const d = await res.json();
          if (!res.ok) {
            setError(d.error || "error");
            return;
          }
          setText("");
          playUiSfx("send");
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
        return;
      }
    }

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
      playUiSfx("send");
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
    setMembers([]);
    lastIdRef.current = 0;
    setTab("boards");
    setMobilePane("chat");
    void joinBoard(id);
  }

  async function friendAction(
    action: string,
    extra: Record<string, unknown> = {}
  ) {
    setError("");
    try {
      const res = await apiFetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error amigos");
        return;
      }
      setFriendUser("");
      await loadFriends();
    } catch {
      setError("red caída");
    }
  }

  function selectDm(id: number) {
    setDmId(id);
    setDmMessages([]);
    dmLastIdRef.current = 0;
    const unlocked = getStorage()?.getItem(dmUnlockKey(id)) === "1";
    setDmUnlocked(unlocked);
    if (!unlocked) setDmPin("");
    setTab("dm");
    setMobilePane("chat");
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

  function msgCtxFor(m: Msg): ContextMenuItem[] {
    const mine = !!(me && m.author_id === me.id);
    const canEdit = mine && !m.deleted && canEditMessageByAge(m.created_at);
    return [
      { id: "copy_msg", label: "copiar mensaje", disabled: !!m.deleted },
      { id: "profile", label: "ver perfil" },
      { id: "mention", label: "mencionar…" },
      { id: "friend", label: "solicitud de amistad…" },
      { id: "dm_author", label: "DM al autor…" },
      { id: "sep_r", label: "", separator: true },
      { id: "edit", label: "editar (≤10h)", disabled: !canEdit },
      { id: "delete", label: "eliminar mensaje", disabled: !mine && tab === "dm" },
      { id: "report", label: "reportar…" },
    ];
  }

  async function reportTarget(
    target_type: "nexo_message" | "nexo_dm" | "user",
    target_id: number
  ) {
    const reason =
      window.prompt(
        "motivo (spam|harassment|nsfw|illegal|impersonation|other):",
        "other"
      ) || "other";
    const details = window.prompt("detalles (opcional):") || "";
    try {
      const res = await apiFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type, target_id, reason, details }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error al reportar");
        return;
      }
      setError("");
      alert("reporte enviado. gracias.");
    } catch {
      setError("red caída");
    }
  }

  async function deleteMsg(m: Msg) {
    if (!window.confirm("¿Eliminar este mensaje?")) return;
    try {
      if (tab === "boards") {
        const res = await apiFetch("/api/nexo/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: m.id, action: "delete" }),
        });
        const d = await res.json();
        if (!res.ok) {
          setError(d.error || "error");
          return;
        }
        setMessages((prev) =>
          prev.map((x) =>
            x.id === m.id ? { ...x, deleted: true, body: "" } : x
          )
        );
      } else {
        const res = await apiFetch("/api/nexo/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            message_id: m.id,
            pin: dmPin,
          }),
        });
        const d = await res.json();
        if (!res.ok) {
          setError(d.error || "error");
          return;
        }
        setDmMessages((prev) =>
          prev.map((x) =>
            x.id === m.id ? { ...x, deleted: true, body: "" } : x
          )
        );
      }
    } catch {
      setError("red caída");
    }
  }

  async function saveEdit(m: Msg) {
    const text = editText.trim();
    if (!text) return;
    setSending(true);
    try {
      if (tab === "boards") {
        const res = await apiFetch("/api/nexo/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: m.id, action: "edit", body: text }),
        });
        const d = await res.json();
        if (!res.ok) {
          setError(d.error || "error");
          return;
        }
        setMessages((prev) =>
          prev.map((x) =>
            x.id === m.id
              ? {
                  ...x,
                  body: text,
                  edited_at: new Date().toISOString(),
                }
              : x
          )
        );
      } else {
        const res = await apiFetch("/api/nexo/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "edit",
            message_id: m.id,
            body: text,
            pin: dmPin,
          }),
        });
        const d = await res.json();
        if (!res.ok) {
          setError(d.error || "error");
          return;
        }
        setDmMessages((prev) =>
          prev.map((x) =>
            x.id === m.id
              ? { ...x, body: text, edited_at: new Date().toISOString() }
              : x
          )
        );
      }
      setEditingId(null);
      setEditText("");
    } catch {
      setError("red caída");
    } finally {
      setSending(false);
    }
  }

  async function setEphemeral(minutes: number) {
    if (!dmId || !dmPin) return;
    try {
      const res = await apiFetch("/api/nexo/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ephemeral",
          thread_id: dmId,
          pin: dmPin,
          minutes,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error");
        return;
      }
      setDmEphemeral(minutes);
    } catch {
      setError("red caída");
    }
  }

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
            onClick={() => {
              setTab("boards");
              setMobilePane("list");
            }}
          >
            boards
          </button>
          <button
            type="button"
            className={tab === "dm" ? "on" : ""}
            onClick={() => {
              setTab("dm");
              setMobilePane("list");
              loadDmList();
            }}
          >
            DM
          </button>
          <button
            type="button"
            className={tab === "friends" ? "on" : ""}
            onClick={() => {
              setTab("friends");
              setMobilePane("list");
              void loadFriends();
            }}
          >
            amigos{incoming.length ? ` (${incoming.length})` : ""}
          </button>
        </div>
        <div className="nexo-actions">
          <VipThemePicker user={me} />
          <Link
            href="/settings"
            className="forum-chip"
            title="configuración de perfil"
          >
            settings
          </Link>
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

      {/* tabs de pane en teléfono */}
      <div className="nexo-mobile-tabs" aria-label="navegación nexo móvil">
        <button
          type="button"
          className={mobilePane === "list" ? "on" : ""}
          onClick={() => setMobilePane("list")}
        >
          lista
        </button>
        <button
          type="button"
          className={mobilePane === "chat" ? "on" : ""}
          onClick={() => setMobilePane("chat")}
          disabled={tab === "friends" || (tab === "boards" ? !boardId : !dmId)}
        >
          chat
        </button>
        {tab === "boards" && boardId ? (
          <button
            type="button"
            className={mobilePane === "members" ? "on" : ""}
            onClick={() => setMobilePane("members")}
          >
            miembros
          </button>
        ) : null}
      </div>

      <div
        className={`nexo-grid${
          tab === "boards" && boardId ? " has-members" : ""
        }${isPhone ? ` mobile-pane-${mobilePane}` : ""}`}
      >
        {/* sidebar */}
        <aside
          className={`nexo-side${mobilePane === "list" ? " show-mobile" : ""}`}
        >
          <div className="forum-pane-head">
            {tab === "boards"
              ? "tablones // nexo"
              : tab === "dm"
                ? "mensajes privados"
                : "amigos"}
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
                    boards.map((b) => {
                      const ownerRank = getRank({
                        role: b.owner_role,
                        username: b.owner_name,
                        is_vip: b.owner_is_vip,
                      });
                      return (
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
                            <span className="nexo-list-title">
                              {b.name}
                              {ownerRank === "vip" || ownerRank === "owner" ? (
                                <span className="nexo-board-vip">
                                  <RankBadge rank={ownerRank} />
                                </span>
                              ) : null}
                            </span>
                            <span className="muted nexo-list-meta">
                              <span className={rankNameClass(ownerRank) || ""}>
                                @{b.owner_name}
                              </span>{" "}
                              · {b.message_count} msg
                            </span>
                          </button>
                        </AppContextMenu>
                      </li>
                      );
                    })
                  )}
                </ul>
              </AppContextMenu>
            ) : tab === "dm" ? (
              <ul className="nexo-list">
                {dmThreads.length === 0 ? (
                  <li className="muted forum-pad">
                    sin DMs. abrí uno con un amigo (según privacidad) + PIN.
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
                          {t.peer?.is_vip || t.peer?.role === "owner" ? (
                            <RankBadge
                              role={t.peer?.role}
                              username={t.peer?.username}
                              isVip={t.peer?.is_vip}
                            />
                          ) : null}
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
            ) : (
              <div className="forum-pad">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void friendAction("request", { username: friendUser });
                  }}
                  style={{ marginBottom: 12 }}
                >
                  <label htmlFor="nexo-friend">solicitud</label>
                  <div className="settings-inline">
                    <input
                      id="nexo-friend"
                      value={friendUser}
                      onChange={(e) => setFriendUser(e.target.value)}
                      placeholder="@usuario"
                      required
                    />
                    <button className="btn" type="submit">
                      +
                    </button>
                  </div>
                </form>
                {incoming.length > 0 && (
                  <>
                    <p className="muted" style={{ fontSize: "0.8rem" }}>
                      entrantes
                    </p>
                    <ul className="nexo-list">
                      {incoming.map((f) => (
                        <li key={f.friendship_id} className="forum-pad">
                          @{f.username}{" "}
                          <RankBadge
                            role={f.role}
                            username={f.username}
                            isVip={f.is_vip}
                          />
                          <div className="settings-inline" style={{ marginTop: 6 }}>
                            <button
                              type="button"
                              className="btn"
                              style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                              onClick={() =>
                                void friendAction("accept", {
                                  friendship_id: f.friendship_id,
                                })
                              }
                            >
                              ok
                            </button>
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                              onClick={() =>
                                void friendAction("reject", {
                                  friendship_id: f.friendship_id,
                                })
                              }
                            >
                              no
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="muted" style={{ fontSize: "0.8rem" }}>
                  amigos ({friends.length})
                </p>
                <ul className="nexo-list">
                  {friends.length === 0 ? (
                    <li className="muted forum-pad">sin amigos.</li>
                  ) : (
                    friends.map((f) => (
                      <li key={f.friendship_id}>
                        <button
                          type="button"
                          className="nexo-list-item"
                          onClick={() => {
                            setTab("dm");
                            setShowDmOpen(true);
                            setDmOpenUser(f.username);
                          }}
                        >
                          <span className="nexo-list-title">
                            @{f.username}{" "}
                            <RankBadge
                              role={f.role}
                              username={f.username}
                              isVip={f.is_vip}
                            />
                          </span>
                          <span className="muted nexo-list-meta">
                            abrir DM
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                {outgoing.length > 0 && (
                  <p className="muted" style={{ fontSize: "0.75rem", marginTop: 8 }}>
                    pendientes: {outgoing.map((o) => `@${o.username}`).join(", ")}
                  </p>
                )}
                <p style={{ marginTop: 10 }}>
                  <Link href="/settings?tab=friends" className="muted">
                    ver en settings →
                  </Link>
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* chat */}
        <section
          className={`nexo-chat${mobilePane === "chat" ? " show-mobile" : ""}`}
        >
          <div className="forum-pane-head">
            {isPhone && (boardId || dmId) && tab !== "friends" ? (
              <button
                type="button"
                className="forum-mini-btn nexo-back-btn"
                onClick={() => setMobilePane("list")}
              >
                ← lista
              </button>
            ) : null}
            {tab === "friends" ? (
              <span>amigos · DMs requieren amistad si el peer lo exige</span>
            ) : tab === "boards" ? (
              activeBoard ? (
                <span>
                  {activeBoard.name}{" "}
                  <span className="muted">@{activeBoard.owner_name}</span>
                  {getRank({
                    role: activeBoard.owner_role,
                    username: activeBoard.owner_name,
                    is_vip: activeBoard.owner_is_vip,
                  }) ? (
                    <RankBadge
                      rank={getRank({
                        role: activeBoard.owner_role,
                        username: activeBoard.owner_name,
                        is_vip: activeBoard.owner_is_vip,
                      })}
                    />
                  ) : null}
                </span>
              ) : (
                <span>elegí un tablón</span>
              )
            ) : dmId ? (
              <span className="nexo-dm-head">
                DM · @{dmPeer || "…"}{" "}
                {dmUnlocked ? (
                  <span className="tag ok">unlocked</span>
                ) : (
                  <span className="tag">
                    <FontAwesomeIcon icon={faLock} className="nexo-lock-icon" />{" "}
                    locked
                  </span>
                )}
                {dmUnlocked ? (
                  <label className="nexo-eph-label muted">
                    efímero
                    <select
                      value={dmEphemeral}
                      onChange={(e) =>
                        void setEphemeral(Number(e.target.value))
                      }
                      title="mensajes se borran tras X minutos"
                    >
                      <option value={0}>off</option>
                      <option value={5}>5 min</option>
                      <option value={30}>30 min</option>
                      <option value={60}>1 h</option>
                      <option value={360}>6 h</option>
                      <option value={1440}>24 h</option>
                    </select>
                  </label>
                ) : null}
              </span>
            ) : (
              <span>elegí o abrí un DM</span>
            )}
          </div>

          {tab === "friends" ? (
            <div className="forum-pad muted">
              <p>
                Gestioná solicitudes a la izquierda. Para chatear, abrí un DM
                con un amigo. Si su privacidad es «solo amigos», no podrás
                abrir DM hasta que acepte la solicitud.
              </p>
              <p>
                También en{" "}
                <Link href="/settings?tab=friends">/settings → amigos</Link>.
              </p>
            </div>
          ) : tab === "dm" && dmId && !dmUnlocked ? (
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
                      ? "seleccioná un board a la izquierda. click derecho = menú de la app. @user = mención."
                      : "seleccioná un DM o creá uno nuevo (gate de amigos si el peer lo exige)."}
                  </p>
                ) : chatMsgs.length === 0 ? (
                  <p className="muted forum-pad">sin mensajes. escribí el primero.</p>
                ) : (
                  chatMsgs.map((m, idx) => {
                    const prev = idx > 0 ? chatMsgs[idx - 1] : null;
                    const sameAuthor =
                      prev &&
                      prev.author_id === m.author_id &&
                      !prev.deleted &&
                      Date.parse(String(m.created_at)) -
                        Date.parse(String(prev.created_at)) <
                        NEXO_GROUP_MS;
                    const showHead = !sameAuthor;
                    const rank = getRank({
                      role: m.author_role,
                      username: m.author_name,
                      is_vip: m.author_is_vip,
                    });
                    const isMine = !!(me && m.author_id === me.id);
                    const initials = (m.author_name || "?")
                      .replace(/^@/, "")
                      .slice(0, 2);
                    const label =
                      m.author_display_name?.trim() || m.author_name;
                    return (
                      <AppContextMenu
                        key={m.id}
                        items={msgCtxFor(m)}
                        onSelect={(id) => {
                          if (id === "copy_msg") {
                            void navigator.clipboard?.writeText(m.body);
                          }
                          if (id === "profile") {
                            router.push(`/u/${encodeURIComponent(m.author_name)}`);
                          }
                          if (id === "mention") {
                            setText((t) =>
                              `${t}${t && !t.endsWith(" ") ? " " : ""}@${m.author_name} `
                            );
                          }
                          if (id === "friend") {
                            void friendAction("request", {
                              username: m.author_name,
                            });
                          }
                          if (id === "dm_author") {
                            setTab("dm");
                            setShowDmOpen(true);
                            setDmOpenUser(m.author_name);
                          }
                          if (id === "edit") {
                            setEditingId(m.id);
                            setEditText(m.body);
                          }
                          if (id === "delete") void deleteMsg(m);
                          if (id === "report") {
                            void reportTarget(
                              tab === "dm" ? "nexo_dm" : "nexo_message",
                              m.id
                            );
                          }
                        }}
                      >
                        <article
                          className={`nexo-msg${isMine ? " mine" : ""}${
                            showHead ? "" : " compact"
                          }${m.deleted ? " deleted" : ""}`}
                        >
                          {showHead ? (
                            <button
                              type="button"
                              className="nexo-msg-avatar"
                              title={`@${m.author_name}`}
                              onClick={() =>
                                router.push(
                                  `/u/${encodeURIComponent(m.author_name)}`
                                )
                              }
                            >
                              {m.author_avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.author_avatar_url} alt="" />
                              ) : (
                                <span>{initials}</span>
                              )}
                            </button>
                          ) : (
                            <div className="nexo-msg-avatar spacer" aria-hidden />
                          )}
                          <div className="nexo-msg-content">
                            {showHead ? (
                              <header className="nexo-msg-meta">
                                <button
                                  type="button"
                                  className={`nexo-msg-user linkish ${rankNameClass(rank) || ""}`.trim()}
                                  onClick={() =>
                                    router.push(
                                      `/u/${encodeURIComponent(m.author_name)}`
                                    )
                                  }
                                >
                                  {label}
                                </button>
                                {m.author_display_name ? (
                                  <span className="muted nexo-msg-handle">
                                    @{m.author_name}
                                  </span>
                                ) : null}
                                {rank ? <RankBadge rank={rank} /> : null}
                                <span className="nexo-msg-time">
                                  {new Date(m.created_at).toLocaleString()}
                                </span>
                              </header>
                            ) : null}
                            {editingId === m.id ? (
                              <div className="nexo-edit-box">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={3}
                                  maxLength={4000}
                                />
                                <div className="settings-inline">
                                  <button
                                    type="button"
                                    className="btn"
                                    disabled={sending}
                                    onClick={() => void saveEdit(m)}
                                  >
                                    guardar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditText("");
                                    }}
                                  >
                                    cancel
                                  </button>
                                </div>
                              </div>
                            ) : m.deleted ? (
                              <div className="nexo-msg-body deleted-body">
                                <em>mensaje eliminado</em>
                              </div>
                            ) : (
                              <>
                                <NexoChatBody
                                  body={m.body}
                                  myUsername={me?.username}
                                />
                                {m.edited_at ? (
                                  <span className="nexo-msg-edited muted">
                                    (editado)
                                  </span>
                                ) : null}
                                {m.expires_at ? (
                                  <span className="nexo-msg-eph muted">
                                    ⏳ expira{" "}
                                    {new Date(m.expires_at).toLocaleTimeString()}
                                  </span>
                                ) : null}
                              </>
                            )}
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
                  <div className="nexo-compose-tools">
                    <NexoEmojiPicker
                      disabled={sending}
                      onPick={(em) =>
                        setText((t) => `${t}${em}`)
                      }
                    />
                    <NexoGifPicker
                      disabled={sending}
                      onPick={(g) =>
                        setText(
                          (t) =>
                            `${t}${t && !t.endsWith("\n") ? "\n" : ""}![gif](${g.url})\n`
                        )
                      }
                    />
                    <NexoFileAttach
                      accept="image"
                      label="img"
                      disabled={sending}
                      onInsert={(md) => setText((t) => t + md)}
                    />
                    <NexoFileAttach
                      accept="pdf"
                      label="PDF"
                      disabled={sending}
                      onInsert={(md) => setText((t) => t + md)}
                    />
                    <span className="muted nexo-compose-hint">
                      **bold** · *italic* · @user
                    </span>
                  </div>
                  <div className="nexo-compose-row">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={
                        tab === "dm"
                          ? "mensaje privado… emoji · GIF · PDF"
                          : "mensaje · emoji · GIF Giphy · PDF · @user"
                      }
                      maxLength={4000}
                      disabled={sending}
                      autoComplete="off"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (text.trim() && !sending) {
                            if (tab === "boards") void sendBoardMsg(e as unknown as FormEvent);
                            else void sendDm(e as unknown as FormEvent);
                          }
                        }
                      }}
                    />
                    <button
                      className="btn"
                      type="submit"
                      disabled={sending || !text.trim()}
                    >
                      send
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>

        {/* member list del board */}
        {tab === "boards" && boardId ? (
          <aside
            className={`nexo-members${
              mobilePane === "members" ? " show-mobile" : ""
            }`}
          >
            <div className="forum-pane-head">
              {isPhone ? (
                <button
                  type="button"
                  className="forum-mini-btn nexo-back-btn"
                  onClick={() => setMobilePane("chat")}
                >
                  ← chat
                </button>
              ) : null}
              miembros · {members.filter((m) => m.online).length} online
            </div>
            <ul className="nexo-members-list">
              {members.length === 0 ? (
                <li className="muted forum-pad" style={{ fontSize: "0.8rem" }}>
                  uniéndote al canal…
                </li>
              ) : (
                members.map((m) => {
                  const rank = getRank({
                    role: m.role,
                    username: m.username,
                    is_vip: m.is_vip,
                  });
                  return (
                    <li key={m.id} className="nexo-member">
                      <span
                        className={`nexo-member-dot${m.online ? " on" : ""}`}
                        title={m.online ? "online" : "offline"}
                      />
                      <button
                        type="button"
                        className="linkish"
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        title={`mencionar @${m.username}`}
                        onClick={() =>
                          setText(
                            (t) =>
                              `${t}${t && !t.endsWith(" ") ? " " : ""}@${m.username} `
                          )
                        }
                      >
                        <span className={rankNameClass(rank) || ""}>
                          @{m.username}
                        </span>
                      </button>
                      {rank ? <RankBadge rank={rank} /> : null}
                    </li>
                  );
                })
              )}
            </ul>
          </aside>
        ) : null}
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

      {/* modal crear board — un solo paso, espejo al foro */}
      {showCreate && (
        <div className="nexo-modal-backdrop" role="presentation">
          <div
            className="nexo-modal nexo-modal-create"
            role="dialog"
            aria-label="crear tablón"
          >
            <h2>crear tablón</h2>
            {createOk ? (
              <div className="nexo-create-ok">
                <p className="form-ok" style={{ margin: 0 }}>
                  listo — <strong>{createOk.name}</strong> ya está vivo.
                </p>
                <ul className="nexo-create-steps muted">
                  <li>
                    chat acá en{" "}
                    <strong>/nexo</strong>
                    {createOk.boardId ? ` (board #${createOk.boardId})` : ""}
                  </li>
                  {createOk.forumPath && (
                    <li>
                      y en el foro:{" "}
                      <Link href={createOk.forumPath}>{createOk.forumPath}</Link>
                      {" "}(bajo // nexo)
                    </li>
                  )}
                </ul>
                <div className="compose-toolbar">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setShowCreate(false);
                      setCreateOk(null);
                    }}
                  >
                    [ entrar al chat ]
                  </button>
                  {createOk.forumPath && (
                    <Link
                      href={createOk.forumPath}
                      className="btn secondary"
                      onClick={() => {
                        setShowCreate(false);
                        setCreateOk(null);
                      }}
                    >
                      ver en foro
                    </Link>
                  )}
                </div>
              </div>
            ) : !vip ? (
              <>
                <p className="form-error">
                  Solo{" "}
                  <span className="vip-badge" data-text="[VIP]">
                    [VIP]
                  </span>{" "}
                  puede crear tablones.{" "}
                  <Link href="/donate">donar →</Link>
                </p>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowCreate(false)}
                >
                  cerrar
                </button>
              </>
            ) : (
              <form onSubmit={createBoard} className="nexo-create-form">
                <p className="muted nexo-create-hint">
                  Un solo nombre y listo. Se crea el <strong>chat</strong> y
                  también el board en el <strong>foro</strong> bajo{" "}
                  <Link href="/forum/nexo">// nexo</Link>.
                </p>

                <label htmlFor="nb-name">1. nombre del tablón</label>
                <input
                  id="nb-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={64}
                  placeholder="ej: random, late-night, hardware…"
                  autoFocus
                  autoComplete="off"
                />

                {newName.trim().length >= 2 && (
                  <div className="nexo-create-preview" aria-live="polite">
                    <div>
                      chat → <code>/nexo</code>
                    </div>
                    <div>
                      foro →{" "}
                      <code>
                        /forum/{slugifyBoardName(newName) || "…"}
                      </code>
                    </div>
                  </div>
                )}

                <label htmlFor="nb-desc">
                  2. de qué va{" "}
                  <span className="muted">(opcional)</span>
                </label>
                <input
                  id="nb-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  maxLength={400}
                  placeholder="una línea alcanza"
                />

                <label className="nexo-create-captcha-label">
                  3. captcha anti-bots
                </label>
                <CaptchaField
                  disabled={sending}
                  refreshKey={boardCaptchaKey}
                  onChange={(p) => {
                    setBoardCaptchaToken(p.token);
                    setBoardCaptchaAnswer(p.answer);
                  }}
                />

                <div className="compose-toolbar">
                  <button
                    className="btn"
                    type="submit"
                    disabled={sending || newName.trim().length < 2}
                  >
                    {sending ? "creando…" : "[ crear tablón ]"}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setShowCreate(false);
                      setCreateOk(null);
                    }}
                  >
                    cancelar
                  </button>
                </div>
              </form>
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
              Username + PIN de 4 dígitos. Si el usuario solo acepta DMs de
              amigos, debés ser amigo primero (pestaña amigos / settings).
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
                  onClick={() => {
                    if (dmOpenUser.trim()) {
                      void friendAction("request", {
                        username: dmOpenUser,
                      });
                    }
                  }}
                >
                  [ + amigo ]
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
