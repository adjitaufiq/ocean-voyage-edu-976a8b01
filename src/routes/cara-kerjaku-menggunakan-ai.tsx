import { createFileRoute } from "@tanstack/react-router";

import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { aiProofDoc } from "@/lib/seo/ai-proof";
import { buildDocHead } from "@/lib/seo/head";

export const Route = createFileRoute("/cara-kerjaku-menggunakan-ai")({
  head: () => buildDocHead(aiProofDoc, { ogType: "article" }),
  component: () => <DocPage doc={aiProofDoc} />,
});
