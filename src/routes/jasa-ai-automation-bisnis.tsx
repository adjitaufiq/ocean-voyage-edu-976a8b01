import { createFileRoute } from "@tanstack/react-router";

import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { buildDocHead, serviceSchema } from "@/lib/seo/head";
import { aiAutomationService } from "@/lib/seo/services";

export const Route = createFileRoute("/jasa-ai-automation-bisnis")({
  head: () =>
    buildDocHead(aiAutomationService, {
      extraSchemas: [serviceSchema(aiAutomationService, "AI Automation Consulting")],
    }),
  component: () => <DocPage doc={aiAutomationService} />,
});
