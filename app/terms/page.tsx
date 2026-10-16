import type { Metadata } from "next";
import LegalMarkdown from "@/components/LegalMarkdown";

export const metadata: Metadata = { title: "Terms of Use" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <LegalMarkdown name="terms" />
    </main>
  );
}
