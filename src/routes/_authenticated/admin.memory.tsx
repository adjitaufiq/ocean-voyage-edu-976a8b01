import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GlassCard } from "@/components/admin/ui";
import {
  clearAssistantMemories,
  deleteAssistantMemory,
  listAssistantMemories,
  saveAssistantMemory,
} from "@/lib/assistant.functions";
import {
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_HINTS,
  MEMORY_CATEGORY_LABELS,
  memoryCategoryClass,
  type MemoryCategory,
} from "@/lib/assistant/memory";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/memory")({
  head: () => ({
    meta: [
      { title: "AI Memory — KERJAKU" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MemoryPage,
});

function MemoryPage() {
  const queryClient = useQueryClient();
  const list = useServerFn(listAssistantMemories);
  const save = useServerFn(saveAssistantMemory);
  const remove = useServerFn(deleteAssistantMemory);
  const clear = useServerFn(clearAssistantMemories);

  const [filter, setFilter] = useState<MemoryCategory | "all">("all");
  const [form, setForm] = useState({
    category: "business" as MemoryCategory,
    title: "",
    content: "",
  });

  const memories = useQuery({ queryKey: ["assistant-memories"], queryFn: () => list() });
  const canManage = memories.data?.role === "owner" || memories.data?.role === "admin";
  const rows = (memories.data?.memories ?? []).filter(
    (m) => filter === "all" || m.category === filter,
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["assistant-memories"] });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.title.trim().length < 2 || form.content.trim().length < 2) return;
    try {
      await save({
        data: { category: form.category, title: form.title.trim(), content: form.content.trim() },
      });
      setForm({ category: form.category, title: "", content: "" });
      await refresh();
      toast.success("Memory disimpan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan memory.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/assistant"
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Assistant
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">AI Memory</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Memori jangka panjang yang dipakai asisten sebelum menjawab.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={async () => {
              await clear({ data: filter === "all" ? {} : { category: filter } });
              await refresh();
              toast.success("Memory dihapus.");
            }}
            className="rounded-xl border border-destructive/40 px-3 py-2 text-xs text-destructive transition hover:bg-destructive/10"
          >
            Hapus {filter === "all" ? "semua" : MEMORY_CATEGORY_LABELS[filter]}
          </button>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        {(["all", ...MEMORY_CATEGORIES] as const).map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition",
              filter === category
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground",
            )}
          >
            {category === "all" ? "Semua" : MEMORY_CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <GlassCard className="space-y-3 p-4">
          {memories.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat memory…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada memory pada kategori ini.</p>
          ) : (
            rows.map((memory) => (
              <article
                key={memory.id}
                className="rounded-2xl border border-border/40 bg-card/30 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.16em]",
                          memoryCategoryClass(memory.category),
                        )}
                      >
                        {MEMORY_CATEGORY_LABELS[memory.category]}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.16em]",
                          memoryProvenanceClass(memory.provenance),
                        )}
                        title="Asal data memory ini"
                      >
                        {MEMORY_PROVENANCE_LABELS[memory.provenance]}
                      </span>
                      <h2 className="truncate text-sm font-semibold">{memory.title}</h2>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {memory.content}
                    </p>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      aria-label="Hapus memory"
                      onClick={async () => {
                        await remove({ data: { id: memory.id } });
                        await refresh();
                      }}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </GlassCard>

        <GlassCard className="h-fit p-4">
          <h2 className="text-sm font-semibold">Tambah memory manual</h2>
          <form className="mt-3 space-y-3" onSubmit={submit}>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, category: event.target.value as MemoryCategory }))
              }
              className="w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs"
            >
              {MEMORY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {MEMORY_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
            <p className="text-[0.65rem] leading-relaxed text-muted-foreground">
              {MEMORY_CATEGORY_HINTS[form.category]}
            </p>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Judul memory"
              className="w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs"
            />
            <textarea
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="Isi memory"
              rows={5}
              className="w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/15 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/25"
            >
              <Plus className="h-4 w-4" /> Simpan memory
            </button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
