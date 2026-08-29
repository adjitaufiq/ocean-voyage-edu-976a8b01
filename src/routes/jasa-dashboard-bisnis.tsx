import { createFileRoute } from "@tanstack/react-router";

import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { buildDocHead, serviceSchema } from "@/lib/seo/head";
import { dashboardService } from "@/lib/seo/services";

export const Route = createFileRoute("/jasa-dashboard-bisnis")({
  head: () =>
    buildDocHead(dashboardService, {
      extraSchemas: [serviceSchema(dashboardService, "Business Dashboard Development")],
    }),
  component: () => <DocPage doc={dashboardService} />,
});
