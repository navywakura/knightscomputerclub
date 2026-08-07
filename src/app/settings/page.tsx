import type { Metadata } from "next";
import SettingsApp from "@/components/settings/SettingsApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "configuración",
  robots: { index: false, follow: false },
  alternates: { canonical: "/settings" },
};

type Props = {
  searchParams: Promise<{ tab?: string; otp_err?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = sp.tab;
  const initial =
    tab === "friends" || tab === "privacy" || tab === "account" || tab === "profile"
      ? tab
      : "profile";
  const otpErr = sp.otp_err ? String(sp.otp_err).slice(0, 280) : null;
  return (
    <main className="page settings-page">
      <SettingsApp initialTab={initial} initialOtpError={otpErr} />
    </main>
  );
}
