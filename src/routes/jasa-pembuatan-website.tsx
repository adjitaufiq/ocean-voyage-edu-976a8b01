import { createFileRoute } from "@tanstack/react-router";

import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { buildDocHead, serviceSchema } from "@/lib/seo/head";
import { websiteService } from "@/lib/seo/services";

export const Route = createFileRoute("/jasa-pembuatan-website")({
  head: () =>
    buildDocHead(websiteService, {
      extraSchemas: [serviceSchema(websiteService, "Website Development")],
    }),
  component: () => <DocPage doc={websiteService} />,
});
