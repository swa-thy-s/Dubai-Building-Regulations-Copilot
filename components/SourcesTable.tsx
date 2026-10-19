"use client";

import { formatDate } from "@/lib/legal";
import { useCorpus } from "./useCorpus";

const PUBLISHER: Record<string, string> = {
  DM: "Dubai Municipality",
  Trakhees: "Trakhees",
  RERA: "Government of Dubai (real estate legislation)",
  Other: "Other publisher (see title)",
};

export default function SourcesTable({ compact = false }: { compact?: boolean }) {
  const { loading, failed, documents } = useCorpus();
  if (loading) return <p className="text-sm text-[var(--muted)]">Loading documents…</p>;
  if (failed) return <p className="text-sm text-[var(--error)]">The document list could not be loaded. Try again later.</p>;
  if (documents.length === 0) return <p className="text-sm text-[var(--muted)]">No documents are indexed yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full min-w-[34rem] text-left text-xs">
        <caption className="sr-only">Indexed documents</caption>
        <thead className="bg-[var(--card)] text-[var(--muted)]">
          <tr>
            <th scope="col" className="p-2">Title</th>
            <th scope="col" className="p-2">Publisher</th>
            <th scope="col" className="p-2">Edition</th>
            <th scope="col" className="p-2">Status</th>
            {!compact && <th scope="col" className="p-2">Official link</th>}
            {!compact && <th scope="col" className="p-2">Indexed</th>}
            <th scope="col" className="p-2">Last verified</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.slug} className="border-t border-[var(--border)] align-top">
              <th scope="row" className="p-2 font-medium">{d.title}</th>
              <td className="p-2">{PUBLISHER[d.authority] ?? d.authority}</td>
              <td className="p-2">{d.edition}</td>
              <td className="p-2">{d.status}</td>
              {!compact && (
                <td className="p-2">
                  {d.source_url ? (
                    <a href={d.source_url} className="underline underline-offset-2" rel="noopener noreferrer">Official source</a>
                  ) : (
                    "Not provided"
                  )}
                </td>
              )}
              {!compact && <td className="p-2">{formatDate(d.ingested_at)}</td>}
              <td className="p-2">{d.last_verified ? formatDate(d.last_verified) : "Not yet verified"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
