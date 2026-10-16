import Link from "next/link";
import { APP_NAME } from "@/lib/legal";

const LINKS = [
  ["/disclaimer", "Disclaimer"],
  ["/terms", "Terms"],
  ["/privacy", "Privacy"],
  ["/sources", "Sources"],
  ["/contact", "Contact"],
] as const;

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] px-4 py-6 text-xs text-[var(--muted)]">
      <nav aria-label="Legal" className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className="underline-offset-2 hover:text-[var(--accent)] hover:underline">
            {label}
          </Link>
        ))}
      </nav>
      <p className="mx-auto mt-3 max-w-2xl text-center">
        {APP_NAME}. Independent reference tool. Not affiliated with any government body.
      </p>
    </footer>
  );
}
