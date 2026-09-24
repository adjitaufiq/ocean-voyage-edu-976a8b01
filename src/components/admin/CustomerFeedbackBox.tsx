import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  getBusinessIntelligenceFn,
  reanalyzeStaleFn,
  recordCustomerResponseFn,
  resolveObjectionFn,
} from "@/lib/crm-intelligence.functions";
import {
  RESPONSE_CHANNEL_LABELS,
  objectionLabel,
  type ResponseChannel,
} from "@/lib/admin/response-analysis";

const STATUS: Record<string, string> = {
  unvalidated: "Dugaan aktif",
  confirmed: "Terkonfirmasi",
  rejected: "Ditolak",
  superseded: "Digantikan",
};
const RESOLUTION: Record<string, string> = {
  open: "Terbuka",
  handled: "Sudah dijawab",
  blocked: "Menghambat",
  irrelevant: "Tidak relevan",
};

export const STALE_WARNING = "Analisis bisnis sudah berubah, perlu diperbarui sebelum follow up.";

type Props = { entityId?: string; candidateId?: string; defaultOpen?: boolean };

export function CustomerFeedbackBox({ entityId, candidateId, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<ResponseChannel>("whatsapp");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const load = useServerFn(getBusinessIntelligenceFn);
  const record = useServerFn(recordCustomerResponseFn);
  const reanalyze = useServerFn(reanalyzeStaleFn);
  const resolve = useServerFn(resolveObjectionFn);
  const key = ["business-intel", entityId ?? candidateId];
  const intel = useQuery({
    queryKey: key,
    enabled: open,
    queryFn: () => load({ data: entityId ? { entityId } : { candidateId: candidateId! } }),
  });
  const data = intel.data;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({ queryKey: ["entity-detail"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-border/50 px-3 py-1.5 text-xs"
      >
        Respons customer & keberatan
      </button>
    );
  }

  const active = data?.findings.filter((f) => f.validationStatus !== "rejected" && f.validationStatus !== "superseded") ?? [];
  const closed = data?.findings.filter((f) => f.validationStatus === "rejected" || f.validationStatus === "superseded") ?? [];

  return (
    <div className="space-y-3 rounded-xl border border-border/50 p-3 text-xs">
      {intel.isLoading ? <p className="text-muted-foreground">Memuat riwayat customer…</p> : null}
      {intel.data === null ? (
        <p className="text-muted-foreground">Bisnis ini belum tertaut ke identitas bisnis terpadu.</p>
      ) : null}
      {data?.staleReason ? (
        <div className="space-y-2 rounded-lg border border-amber-400/50 bg-amber-400/10 p-2 text-amber-200">
          <p className="font-semibold">{STALE_WARNING}</p>
          <p>Sebab: {data.staleReason}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => reanalyze({ data: { entityIds: [data.entityId] } }), "Analisis diperbarui")}
            className="rounded-lg border border-amber-400/50 px-2 py-1 disabled:opacity-50"
          >
            Perbarui analisis
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="space-y-2">
            <p className="font-semibold">Catat respons customer</p>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ResponseChannel)}
              className="rounded-lg border border-border/50 bg-background/40 px-2 py-1"
            >
              {(Object.keys(RESPONSE_CHANNEL_LABELS) as ResponseChannel[]).map((c) => (
                <option key={c} value={c}>
                  {RESPONSE_CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Tempel balasan customer atau catatan percakapan…"
              className="w-full rounded-lg border border-border/50 bg-background/40 p-2"
            />
            <button
              type="button"
              disabled={busy || text.trim().length < 2}
              onClick={() =>
                void run(async () => {
                  await record({ data: { entityId: data.entityId, channel, content: text.trim() } });
                  setText("");
                }, "Respons customer tersimpan")
              }
              className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
            >
              Simpan respons
            </button>
          </div>

          <div>
            <p className="font-semibold">Temuan aktif</p>
            {active.length ? (
              <ul className="list-disc pl-4">
                {active.map((f) => (
                  <li key={f.id}>
                    <span className="text-muted-foreground">
                      {f.kind === "fact" ? "Fakta" : "Dugaan"} • {STATUS[f.validationStatus] ?? f.validationStatus}:{" "}
                    </span>
                    {f.statement}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Belum ada.</p>
            )}
            {closed.length ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-muted-foreground">
                  Riwayat temuan ditolak/digantikan ({closed.length})
                </summary>
                <ul className="list-disc pl-4 text-muted-foreground line-through">
                  {closed.map((f) => (
                    <li key={f.id}>{f.statement}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <div>
            <p className="font-semibold">Keberatan customer</p>
            {data.objections.length ? (
              <ul className="space-y-1">
                {data.objections.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2">
                    <span>{objectionLabel(o.category)}</span>
                    <span className="text-muted-foreground">“{o.quote}”</span>
                    <select
                      value={o.resolution}
                      disabled={busy}
                      onChange={(e) =>
                        void run(
                          () =>
                            resolve({
                              data: {
                                objectionId: o.id,
                                resolution: e.target.value as "open" | "handled" | "blocked" | "irrelevant",
                              },
                            }),
                          "Keberatan diperbarui",
                        )
                      }
                      className="rounded border border-border/50 bg-background/40 px-1"
                    >
                      {Object.entries(RESOLUTION).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Belum ada.</p>
            )}
          </div>

          <div>
            <p className="font-semibold">Riwayat interaksi ({data.interactions.length})</p>
            {data.interactions.length ? (
              <ul className="space-y-1">
                {data.interactions.map((i) => (
                  <li key={i.id}>
                    <span className="text-muted-foreground">
                      {new Date(i.occurredAt).toLocaleString("id-ID")} •{" "}
                      {RESPONSE_CHANNEL_LABELS[i.channel as ResponseChannel] ?? i.channel}:{" "}
                    </span>
                    {i.content}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Belum ada.</p>
            )}
            <p className="mt-1 text-muted-foreground">
              Analisis versi {data.analysisVersion ?? "—"} • konteks penjualan versi {data.snapshotVersion ?? "—"}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
