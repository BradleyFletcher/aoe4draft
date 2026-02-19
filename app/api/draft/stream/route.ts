import { NextRequest } from "next/server";
import { isValidSeed } from "@/lib/storage";
import { subscribe } from "@/lib/draft-events";

export const dynamic = "force-dynamic";

// SSE endpoint: GET /api/draft/stream?seed=XYZ
// Holds the connection open and pushes version updates when the draft changes.
export async function GET(req: NextRequest) {
  const seed = req.nextUrl.searchParams.get("seed");
  if (!seed || !isValidSeed(seed)) {
    return new Response("Invalid seed", { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial comment to confirm the connection
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Subscribe to draft updates for this seed
      unsubscribe = subscribe(seed, (version: number) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ version })}\n\n`),
          );
        } catch {
          // Stream closed
        }
      });

      // Send a heartbeat every 30s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      // Clean up when the client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
