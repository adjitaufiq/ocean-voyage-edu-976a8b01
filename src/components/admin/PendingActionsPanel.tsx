import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  cancelAssistantAction,
  confirmAssistantAction,
  listAssistantPendingActions,
} from "@/lib/assistant.functions";

const LABELS: Record<string, string> = {
  create_followup_task: "Buat task follow-up",
  create_project_task: "Buat task project",
  update_lead_status: "Ubah status lead",
  save_sales_activity: "Simpan aktivitas sales",
};

function expiresLabel(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return "kedaluwarsa";
  return `berlaku ${minutes} menit lagi`;
}

/**
 * Sensitive AI writes never execute from the model's own output. They land here
 * as pending proposals and run only after the signed-in user confirms.
 */
export function PendingActionsPanel({ refreshKey }: { refreshKey?: number }) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listAssistantPendingActions);
  const confirmFn = useServerFn(confirmAssistantAction);
  const cancelFn = useServerFn(cancelAssistantAction);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["assistant-pending-actions", refreshKey ?? 0],
    queryFn: () => listFn(),
    refetchInterval: 20_000,
  });

  const mutation = useMutation({
    mutationFn: async ({ id, confirm }: { id: string; confirm: boolean }) =>
      confirm ? confirmFn({ data: { id } }) : cancelFn({ data: { id } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      void queryClient.invalidateQueries({ queryKey: ["assistant-pending-actions"] });
    },
    onError: () => toast.error("Aksi tidak dapat diproses. Silakan coba lagi."),
    onSettled: () => setBusyId(null),
  });

  if (data.length === 0) return null;

  return (
    <div className="mt-4 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <p className="flex items-center gap-2 text-xs font-medium text-primary">
        <ShieldAlert className="size-3.5" />
        Menunggu konfirmasi Anda
      </p>
      {data.map((action) => (
        <div
          key={action.id}
          className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm text-foreground">
              {LABELS[action.action_type] ?? action.action_type}
            </p>
            <p className="truncate text-xs text-muted-foreground">{action.summary}</p>
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              {expiresLabel(action.expires_at)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              disabled={mutation.isPending}
              onClick={() => {
                setBusyId(action.id);
                mutation.mutate({ id: action.id, confirm: true });
              }}
            >
              <Check className="size-3.5" />
              {busyId === action.id && mutation.isPending ? "Memproses…" : "Konfirmasi"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => {
                setBusyId(action.id);
                mutation.mutate({ id: action.id, confirm: false });
              }}
            >
              <X className="size-3.5" />
              Batalkan
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
