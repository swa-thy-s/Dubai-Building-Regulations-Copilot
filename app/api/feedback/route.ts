import { z } from "zod/v4";
import { getSupabase } from "@/lib/supabase";

const FeedbackSchema = z.object({
  query_log_id: z.string().min(1),
  vote: z.enum(["up", "down"]),
  comment: z.string().max(2000).optional(),
  correct_clause: z.string().max(200).optional(),
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

  const { query_log_id, vote, comment, correct_clause } = parsed.data;

  const { error } = await getSupabase().from("feedback").insert({
    query_log_id,
    rating: vote === "up" ? 1 : -1,
    comment: comment || null,
    correct_clause: correct_clause || null,
  });

  if (error) {
    console.error("Feedback insert failed:", error.message);
    return Response.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
