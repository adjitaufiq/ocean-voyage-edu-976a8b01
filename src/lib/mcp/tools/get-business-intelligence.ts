import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_business_intelligence",
  title: "Ringkasan kecerdasan bisnis",
  description: "Ambil temuan, keberatan, dan riwayat respons customer untuk satu bisnis.",
  inputSchema: { business_id: z.string().uuid().describe("ID bisnis dari search_businesses.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ business_id }, ctx) => {
    const supabase = supabaseForUser(ctx);
    const [findings, objections, interactions] = await Promise.all([
      supabase
        .from("business_findings")
        .select("kind, statement, validation_status, confidence")
        .eq("business_entity_id", business_id)
        .limit(50),
      supabase
        .from("business_objections")
        .select("category, quote, resolution")
        .eq("business_entity_id", business_id)
        .limit(30),
      supabase
        .from("business_interactions")
        .select("channel, content, occurred_at")
        .eq("business_entity_id", business_id)
        .order("occurred_at", { ascending: false })
        .limit(20),
    ]);
    const err = findings.error ?? objections.error ?? interactions.error;
    if (err) return { content: [{ type: "text", text: err.message }], isError: true };
    const result = {
      findings: (findings.data ?? []).map((f) => ({
        kind: f.kind,
        statement: f.statement,
        status: f.validation_status,
        confidence: f.confidence,
      })),
      objections: (objections.data ?? []).map((o) => ({
        category: o.category,
        quote: o.quote,
        resolution: o.resolution,
      })),
      interactions: (interactions.data ?? []).map((i) => ({
        channel: i.channel,
        content: i.content,
        at: i.occurred_at,
      })),
    };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
