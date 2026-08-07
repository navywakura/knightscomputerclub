/** @deprecated Prefer RankBadge — kept for simple VIP-only spots */
export default function VipBadge({ className = "" }: { className?: string }) {
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
