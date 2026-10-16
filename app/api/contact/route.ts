import { z } from "zod/v4";
import { headers } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { hashIP, checkKeyLimit } from "@/lib/pipeline/rate-limit";

const ContactSchema = z.object({
  message: z.string().trim().min(5).max(2000),
  reach: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await checkKeyLimit(`contact:${hashIP(ip)}`, 5, 3600_000))) {
    return Response.json({ error: "Too many messages. Try again later." }, { status: 429 });
  }

  const { message, reach } = parsed.data;
  const comment = `[contact] ${message}${reach ? `\n[reach] ${reach}` : ""}`;
  const { error } = await getSupabase().from("feedback").insert({ comment });
  if (error) {
    console.error("Contact insert failed:", error.message);
    return Response.json({ error: "Could not save your message" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
