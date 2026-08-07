"use client";

import type { ReactNode } from "react";

/** Resalta @menciones en mensajes de nexo (ping visual). */
export default function NexoChatBody({
  body,
  myUsername,
}: {
  body: string;
  myUsername?: string | null;
}) {
  const me = (myUsername || "").toLowerCase();
  const text = String(body || "");
  const lines = text.split("\n");

  let pingMe = false;
  const re = /(^|[^a-zA-Z0-9_])(@[a-zA-Z0-9_\-]{2,32})\b/g;
  let scan: RegExpExecArray | null;
  while ((scan = re.exec(text))) {
    if (me && scan[2].slice(1).toLowerCase() === me) {
      pingMe = true;
      break;
    }
  }

  const out: ReactNode[] = [];
  lines.forEach((line, li) => {
    if (li > 0) out.push(<br key={`br-${li}`} />);
    const lineRe = /(^|[^a-zA-Z0-9_])(@[a-zA-Z0-9_\-]{2,32})\b/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    let any = false;
    while ((m = lineRe.exec(line))) {
      any = true;
      const full = m[0];
      const prefix = m[1] || "";
      const mention = m[2];
      const start = m.index;
      if (start > last) {
        out.push(
          <span key={`${li}-t-${i++}`}>{line.slice(last, start)}</span>
        );
      }
      if (prefix) out.push(<span key={`${li}-p-${i++}`}>{prefix}</span>);
      out.push(
        <span key={`${li}-m-${i++}`} className="nexo-mention">
          {mention}
        </span>
      );
      last = start + full.length;
    }
    if (!any) {
      out.push(<span key={`${li}-all`}>{line}</span>);
    } else if (last < line.length) {
      out.push(<span key={`${li}-e`}>{line.slice(last)}</span>);
    }
  });

  return (
    <div className={`nexo-msg-body${pingMe ? " ping-me" : ""}`}>{out}</div>
  );
}
