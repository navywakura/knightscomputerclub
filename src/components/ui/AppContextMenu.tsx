"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ContextMenuItem = {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
};

type Props = {
  children: ReactNode;
  items: ContextMenuItem[];
  onSelect: (id: string) => void;
  className?: string;
  /** desactiva menú nativo del browser en este árbol */
  disableNative?: boolean;
};

type Pos = { x: number; y: number };

/**
 * Menú contextual estilo app (no del SO/navegador).
 * Escalable a Electron: mismos eventos, sin chrome nativo.
 */
export default function AppContextMenu({
  children,
  items,
  onSelect,
  className = "",
  disableNative = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const el = menuRef.current;
    const r = el.getBoundingClientRect();
    let { x, y } = pos;
    if (x + r.width > window.innerWidth - 8) x = window.innerWidth - r.width - 8;
    if (y + r.height > window.innerHeight - 8)
      y = window.innerHeight - r.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [open, pos]);

  function onContextMenu(e: React.MouseEvent) {
    if (disableNative) e.preventDefault();
    setPos({ x: e.clientX, y: e.clientY });
    setOpen(true);
  }

  return (
    <div
      ref={rootRef}
      className={`app-ctx-root ${className}`.trim()}
      onContextMenu={onContextMenu}
    >
      {children}
      {open ? (
        <div
          ref={menuRef}
          className="app-ctx-menu"
          style={{ left: pos.x, top: pos.y }}
          role="menu"
        >
          {items.map((item) =>
            item.separator ? (
              <div key={item.id} className="app-ctx-sep" role="separator" />
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`app-ctx-item${item.danger ? " danger" : ""}`}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  onSelect(item.id);
                  close();
                }}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
