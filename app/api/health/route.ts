import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { error } = await getSupabase().from("documents").select("id").limit(1);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
