import { createFileRoute } from "@tanstack/react-router";

import { DocPage } from "@/components/kerjaku/marketing/DocPage";
import { buildDocHead, serviceSchema } from "@/lib/seo/head";
import { customAppService } from "@/lib/seo/services";

export const Route = createFileRoute("/jasa-pembuatan-aplikasi-custom")({
  head: () =>
    buildDocHead(customAppService, {
      extraSchemas: [serviceSchema(customAppService, "Custom Application Development")],
    }),
  component: () => <DocPage doc={customAppService} />,
});
