import Link from "next/link";
import { BANNER_TEXT } from "@/lib/legal";

export default function TopBanner() {
  return (
    <div
      role="note"
      aria-label="Important notice"
      className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--accent-light)] px-4 py-2 text-center text-xs leading-snug text-[var(--foreground)] sm:text-sm"
    >
      <strong>{BANNER_TEXT}</strong>{" "}
      <Link href="/disclaimer" className="underline underline-offset-2">
        Disclaimer
      </Link>
    </div>
  );
}
