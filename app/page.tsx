import Link from "next/link";
import SourcesTable from "@/components/SourcesTable";
import StaleBanner from "@/components/StaleBanner";

const EXAMPLES = [
  "What is the minimum headroom in a stairway?",
  "What are the handrail and guardrail height requirements for stairs?",
  "What is the minimum clear width of a corridor in a retail building?",
  "What is the minimum area for a residential living space such as a bedroom?",
  "Can public toilets be shared by both sexes?",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function Landing() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Dubai Regulations Copilot</h1>
      <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">
        Ask a question about Dubai building regulations in plain English. Get a short answer with the exact clause,
        document, edition and page behind it, or a clear &ldquo;not found&rdquo; when the indexed documents do not say.
      </p>
      <div className="mt-6">
        <Link
          href="/ask"
          className="inline-block rounded-lg bg-[var(--accent-solid)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Open the tool
        </Link>
      </div>

      <div className="mt-8">
        <StaleBanner />
      </div>

      <Section title="What it is">
        <p>
          A search-and-summary tool over a fixed set of published documents. It finds the clauses that match your
          question, writes a short answer using only those clauses, and shows each clause as a quote with its document,
          edition, clause number and page so you can read the original.
        </p>
      </Section>

      <Section title="Who it is for">
        <p>Architects, interior designers, fit-out contractors and development teams who need to find a requirement quickly and then check it at the source.</p>
      </Section>

      <Section title="What it is not">
        <ul className="list-disc space-y-1 pl-5">
          <li>It is not an official source, and it is not connected to any government body.</li>
          <li>It is not legal, engineering, architectural or compliance advice.</li>
          <li>It does not approve, certify or check a design. It only shows what a clause says.</li>
        </ul>
        <p>
          Read the full <Link href="/disclaimer" className="underline underline-offset-2">Disclaimer</Link>,{" "}
          <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </Section>

      <Section title="How it works">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Your question is matched against the indexed clauses.</li>
          <li>If nothing relevant is found, the tool says so and stops. It does not guess.</li>
          <li>Otherwise an AI model writes a short answer from the matched clauses only.</li>
          <li>The software then checks that every cited clause was really retrieved and that every number in the answer appears in a cited clause. If a check fails, the answer is withheld.</li>
        </ol>
      </Section>

      <Section title="What is covered">
        <p>Only the documents below. If a topic is not listed, the tool has no information on it.</p>
        <SourcesTable compact />
        <p>
          More detail, including copyright notes, is on the{" "}
          <Link href="/sources" className="underline underline-offset-2">Sources page</Link>.
        </p>
      </Section>

      <Section title="Try a question">
        <ul className="space-y-2">
          {EXAMPLES.map((q) => (
            <li key={q}>
              <Link
                href={`/ask?q=${encodeURIComponent(q)}`}
                className="block rounded-lg border border-[var(--border)] px-3 py-2 hover:border-[var(--accent)] hover:bg-[var(--accent-light)]"
              >
                {q}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Honest limits">
        <ul className="list-disc space-y-1 pl-5">
          <li>Answers are produced with AI and can be wrong or incomplete even when they cite a clause.</li>
          <li>Documents may have been amended or replaced. Check the edition and the last-verified date shown.</li>
          <li>Tables, figures and drawings can be misread during processing. Always read the original page.</li>
          <li>Permit procedures, fees and approvals are often not in a building code. If they are not in the listed documents, the tool will not have them.</li>
          <li>Do not enter confidential or personal information. Questions are processed by third-party AI services.</li>
        </ul>
      </Section>

      <Section title="About">
        <p>
          Dubai Regulations Copilot is an independent project, free to use and in beta. It is not run by, or connected to,
          any government body.
        </p>
      </Section>
    </main>
  );
}
