export type DonationChannel = {
  id: string;
  label: string;
  kind: "link" | "address";
  value: string;
  hint: string;
  glyph: string;
};

export function getDonationChannels(): DonationChannel[] {
  return [
    {
      id: "paypal",
      label: "PayPal",
      kind: "link",
      value:
        process.env.NEXT_PUBLIC_PAYPAL_URL ||
        "https://paypal.me/PLACEHOLDER",
      hint: "fiat · clic y listo",
      glyph: "$",
    },
    {
      id: "kofi",
      label: "Ko-fi",
      kind: "link",
      value:
        process.env.NEXT_PUBLIC_KOFI_URL || "https://ko-fi.com/PLACEHOLDER",
      hint: "café para el kernel",
      glyph: "☕",
    },
    {
      id: "btc",
      label: "Bitcoin",
      kind: "address",
      value:
        process.env.NEXT_PUBLIC_BTC_ADDRESS ||
        "bc1qPLACEHOLDER_BITCOIN_ADDRESS",
      hint: "on-chain · L1",
      glyph: "₿",
    },
    {
      id: "sol",
      label: "Solana",
      kind: "address",
      value:
        process.env.NEXT_PUBLIC_SOL_ADDRESS ||
        "PLACEHOLDER_SOLANA_ADDRESS",
      hint: "SOL · network",
      glyph: "◎",
    },
    {
      id: "usdt",
      label: "USDT",
      kind: "address",
      value:
        process.env.NEXT_PUBLIC_USDT_ADDRESS ||
        "PLACEHOLDER_USDT_TRC20_OR_ERC20",
      hint: "stable · TRC20/ERC20",
      glyph: "₮",
    },
  ];
}
