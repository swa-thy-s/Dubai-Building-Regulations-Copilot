import { z } from "zod/v4";
import { headers } from "next/headers";
import { hashIP, checkRateLimit } from "@/lib/pipeline/rate-limit";
import { runPipeline } from "@/lib/pipeline/pipeline";

const RequestSchema = z.object({
  question: z.string().min(1).max(500),
  authorities: z.array(z.enum(["DM", "Trakhees", "RERA", "Other"])).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { question, authorities } = parsed.data;

  // Get IP and hash it
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const ipHash = hashIP(ip);

  // Rate limit
  const rateCheck = await checkRateLimit(ipHash);
  if (!rateCheck.allowed) {
    return Response.json(
      { error: rateCheck.reason, code: rateCheck.code, reset_at: rateCheck.resetAt },
      { status: 429 },
    );
  }

  // Stream response via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        const result = await runPipeline(
          question,
          authorities,
          ipHash,
          (p) => send("progress", p),
        );
        send("result", result);
      } catch (e) {
        send("error", {
          error: "Internal error",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
