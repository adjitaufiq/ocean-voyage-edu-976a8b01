import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_businesses",
  title: "Cari bisnis",
  description: "Cari bisnis terpadu (prospek/kandidat) berdasarkan nama atau kota.",
  inputSchema: {
    query: z.string().trim().min(1).max(120).describe("Nama bisnis atau kota."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    const supabase = supabaseForUser(ctx);
    const q = query.replace(/[%,()]/g, " ");
    const { data, error } = await supabase
      .from("business_entities")
      .select("id, canonical_name, industry, city, website, current_stage")
      .or(`canonical_name.ilike.%${q}%,city.ilike.%${q}%`)
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const businesses = (data ?? []).map((b) => ({
      id: b.id,
      name: b.canonical_name,
      industry: b.industry,
      city: b.city,
      website: b.website,
      stage: b.current_stage,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(businesses) }],
      structuredContent: { businesses },
    };
  },
});
