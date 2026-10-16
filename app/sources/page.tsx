import type { Metadata } from "next";
import LegalMarkdown from "@/components/LegalMarkdown";
import SourcesTable from "@/components/SourcesTable";

export const metadata: Metadata = { title: "Sources and copyright" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <LegalMarkdown name="sources-notice" />
        <h2 className="mt-6 text-lg font-semibold">Documents covered</h2>
        <p className="mt-1 mb-3 text-sm text-[var(--muted)]">
          This list comes from the database the tool searches. A link is shown only when an official source URL has been recorded.
        </p>
      </div>
      <SourcesTable />
      <div className="mx-auto mt-6 max-w-2xl">
        <LegalMarkdown name="sources-keep" />
      </div>
    </main>
  );
}
