import { z } from "zod/v4";
import { getSupabase } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FeedbackSchema = z
  .object({
    kind: z.enum(["rating", "missing_topic"]).default("rating"),
    query_log_id: z.string().min(1).optional(),
    vote: z.enum(["up", "down"]).optional(),
    comment: z.string().max(2000).optional(),
    correct_clause: z.string().max(200).optional(),
    question: z.string().max(500).optional(),
  })
  .refine((d) => d.kind === "missing_topic" || (d.vote !== undefined && d.query_log_id !== undefined), {
    message: "A rating needs query_log_id and vote",
  });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { kind, vote, comment, correct_clause, question } = parsed.data;
  const queryLogId = parsed.data.query_log_id && UUID.test(parsed.data.query_log_id) ? parsed.data.query_log_id : null;

  const row: { query_log_id: string | null; rating: number | null; comment: string | null; correct_clause: string | null } =
    kind === "missing_topic"
      ? { query_log_id: queryLogId, rating: null, comment: `[missing topic] ${question ?? comment ?? ""}`.trim(), correct_clause: null }
      : { query_log_id: queryLogId, rating: vote === "up" ? 1 : -1, comment: comment || null, correct_clause: correct_clause || null };

  const { error } = await getSupabase().from("feedback").insert(row);
  if (error) {
    console.error("Feedback insert failed:", error.message);
    return Response.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
