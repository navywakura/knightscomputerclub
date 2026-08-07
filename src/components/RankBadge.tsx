import { getRank, type RankKind } from "@/lib/ranks";

type Props = {
  role?: string | null;
  username?: string | null;
  isVip?: boolean | null;
  className?: string;
  /** Override if rank already resolved */
  rank?: RankKind;
};

function OwnerBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`owner-badge ${className}`.trim()}
      title="Owner del nodo"
      data-text="[OWNER]"
    >
      [OWNER]
      <span className="owner-snow" aria-hidden>
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

function VipBadgeInner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`vip-badge ${className}`.trim()}
      title="Donante verificado del nodo"
      data-text="[VIP]"
    >
      [VIP]
    </span>
  );
}

/** Badge de rango: [OWNER] (prioridad) o [VIP] */
export default function RankBadge({
  role,
  username,
  isVip,
  className = "",
  rank: rankProp,
}: Props) {
  const rank =
    rankProp ??
    getRank({ role, username, is_vip: Boolean(isVip) });

  if (rank === "owner") return <OwnerBadge className={className} />;
  if (rank === "vip") return <VipBadgeInner className={className} />;
  return null;
}
