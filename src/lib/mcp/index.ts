import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchBusinesses from "./tools/search-businesses";
import getBusinessIntelligence from "./tools/get-business-intelligence";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "kerjaku-space",
  title: "Kerjaku_space",
  version: "0.1.0",
  instructions:
    "Alat baca untuk workspace sales KERJAKU. Pakai `search_businesses` untuk menemukan bisnis, lalu `get_business_intelligence` untuk temuan, keberatan, dan riwayat respons customer.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchBusinesses, getBusinessIntelligence],
});
