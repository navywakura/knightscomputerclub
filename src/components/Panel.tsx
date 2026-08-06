import { ReactNode } from "react";

export default function Panel({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-title">
        <span>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {right}
          <span className="dots" aria-hidden>
            <span className="dot r" />
            <span className="dot y" />
            <span className="dot g" />
          </span>
        </span>
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
