import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, KeyRound, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Chip, SectionCard } from "@/components/admin/ui";
import { syncOpsCronSecret } from "@/lib/ops.functions";
import {
  deleteWorkspaceMember,
  getAdminAccess,
  getWorkspaceMembers,
  upsertWorkspaceMember,
} from "@/lib/admin.functions";
import {
  ROLE_DESCRIPTIONS,
  canManageBusiness,
  ROLE_LABELS,
  WORKSPACE_ROLES,
  isWorkspaceRole,
  roleBadgeClass,
  type WorkspaceRole,
} from "@/lib/admin/roles";
import {
  disableBiometricUnlock,
  getEnrolledEmail,
  isBiometricSupported,
  signOutEverywhere,
  signOutKeepingQuickUnlock,
} from "@/lib/auth/biometric-unlock";
import {
  AI_TONES,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  type AiTone,
  type WorkspaceSettings,
} from "@/lib/admin/workspace-settings";

function BiometricCard() {
  const [supported, setSupported] = useState(false);
  const [enrolledEmail, setEnrolledEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const ok = await isBiometricSupported();
      const enrolled = ok ? await getEnrolledEmail() : null;
      if (!active) return;
      setSupported(ok);
      setEnrolledEmail(enrolled);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <SectionCard
      title="Buka cepat sidik jari"
      description="Status buka cepat biometrik untuk perangkat yang sedang dipakai."
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/50">
          <Fingerprint className="h-5 w-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">
            {!supported
              ? "Perangkat ini tidak mendukung biometrik."
              : enrolledEmail
                ? `Aktif untuk ${enrolledEmail}`
                : "Belum aktif di perangkat ini."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {enrolledEmail
              ? "Sesi tersimpan terenkripsi di perangkat ini saja."
              : "Aktifkan lewat tawaran yang muncul setelah masuk dengan password."}
          </p>
        </div>
        {enrolledEmail ? (
          <button
            type="button"
            onClick={async () => {
              await disableBiometricUnlock();
              setEnrolledEmail(null);
              toast.success("Buka cepat dimatikan di perangkat ini.");
            }}
            className="rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Matikan di perangkat ini
          </button>
        ) : null}
      </div>
    </SectionCard>
  );
}

function SchedulerKeyCard() {
  const syncFn = useServerFn(syncOpsCronSecret);
  const [busy, setBusy] = useState(false);

  return (
    <SectionCard
      title="Kunci penjadwal otomatis"
      description="Diperlukan agar brief harian dan pemindaian otomatis bisa berjalan sendiri dengan aman."
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/50">
          <KeyRound className="h-5 w-5 text-primary" />
        </span>
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Jalankan sekali setelah kunci diperbarui. Nilainya tidak pernah ditampilkan di layar.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await syncFn();
              if (result.ok) toast.success(result.message);
              else toast.error(result.message);
            } catch {
              toast.error("Kunci scheduler gagal disinkronkan.");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-60"
        >
          {busy ? "Menyinkronkan…" : "Sinkronkan kunci"}
        </button>
      </div>
    </SectionCard>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none transition focus:border-primary/60"
      />
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/40 bg-background/30 px-3 py-2.5">
      <span className="min-w-0 truncate text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-primary"
      />
    </label>
  );
}

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useServerFn(getAdminAccess);
  const listMembers = useServerFn(getWorkspaceMembers);
  const saveMember = useServerFn(upsertWorkspaceMember);
  const removeMember = useServerFn(deleteWorkspaceMember);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("sales");
  const [settings, setSettings] = useState<WorkspaceSettings>(() => loadWorkspaceSettings());

  useEffect(() => {
    setSettings(loadWorkspaceSettings());
  }, []);

  function patch(partial: Partial<WorkspaceSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  function savePreferences() {
    saveWorkspaceSettings(settings);
    toast.success("Preferensi workspace disimpan.");
  }

  const { data } = useQuery({ queryKey: ["admin", "access"], queryFn: () => access() });
  const canManage = Boolean(data?.canManage);

  const members = useQuery({
    queryKey: ["admin", "members"],
    queryFn: () => listMembers(),
    enabled: canManage,
  });

  const addMutation = useMutation({
    mutationFn: () => saveMember({ data: { email, role } }),
    onSuccess: () => {
      toast.success("Akses tim diperbarui.");
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan anggota."),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeMember({ data: { id } }),
    onSuccess: () => {
      toast.success("Anggota dihapus dari whitelist.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Gagal menghapus anggota."),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOutKeepingQuickUnlock();
    navigate({ to: "/auth", replace: true });
  }

  async function signOutFully() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOutEverywhere();
    navigate({ to: "/auth", replace: true });
  }

  const currentRole = isWorkspaceRole(data?.role) ? data.role : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Akun, akses tim, dan sesi workspace.</p>
      </div>

      <SectionCard title="Akun" description="Sesi yang sedang aktif.">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              Role
            </dt>
            <dd className="mt-1 text-sm">
              <Chip className={roleBadgeClass(currentRole)}>
                {currentRole ? ROLE_LABELS[currentRole] : "—"}
              </Chip>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              User ID
            </dt>
            <dd className="mt-1 break-all text-sm">{data?.userId ?? "—"}</dd>
          </div>
        </dl>
      </SectionCard>

      {currentRole === "owner" ? <BiometricCard /> : null}

      {canManageBusiness(currentRole) ? <SchedulerKeyCard /> : null}



      <SectionCard
        title="Company Profile"
        description="Identitas bisnis yang dipakai di proposal dan komunikasi sales."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Nama perusahaan"
            value={settings.companyName}
            onChange={(v) => patch({ companyName: v })}
          />
          <TextField
            label="Tagline"
            value={settings.companyTagline}
            onChange={(v) => patch({ companyTagline: v })}
          />
          <TextField
            label="Email perusahaan"
            value={settings.companyEmail}
            onChange={(v) => patch({ companyEmail: v })}
          />
          <TextField
            label="Website"
            value={settings.companyWebsite}
            onChange={(v) => patch({ companyWebsite: v })}
          />
          <TextField
            label="Alamat / kota"
            className="sm:col-span-2"
            value={settings.companyAddress}
            onChange={(v) => patch({ companyAddress: v })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Sales Contact"
        description="Kontak yang muncul saat follow-up lead dan pengiriman proposal."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Nama sales"
            value={settings.salesName}
            onChange={(v) => patch({ salesName: v })}
          />
          <TextField
            label="WhatsApp"
            value={settings.salesWhatsapp}
            placeholder="628xxxxxxxxxx"
            onChange={(v) => patch({ salesWhatsapp: v })}
          />
          <TextField
            label="Email sales"
            value={settings.salesEmail}
            onChange={(v) => patch({ salesEmail: v })}
          />
          <TextField
            label="Jam operasional"
            value={settings.salesHours}
            onChange={(v) => patch({ salesHours: v })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="AI Tone Preference"
        description="Gaya bahasa default untuk AI Sales Assistant dan draft proposal."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              Tone
            </span>
            <select
              value={settings.aiTone}
              onChange={(e) => patch({ aiTone: e.target.value as AiTone })}
              className="mt-1 w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none transition focus:border-primary/60"
            >
              {AI_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              Bahasa
            </span>
            <select
              value={settings.aiLanguage}
              onChange={(e) =>
                patch({ aiLanguage: e.target.value as "Indonesia" | "English" })
              }
              className="mt-1 w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none transition focus:border-primary/60"
            >
              <option value="Indonesia">Indonesia</option>
              <option value="English">English</option>
            </select>
          </label>
          <TextField
            label="Signature"
            className="sm:col-span-2"
            value={settings.aiSignature}
            onChange={(v) => patch({ aiSignature: v })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Notification Preferences"
        description="Atur kapan workspace mengingatkan tim sales."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleRow
            label="Lead baru masuk"
            checked={settings.notifyNewLead}
            onChange={(v) => patch({ notifyNewLead: v })}
          />
          <ToggleRow
            label="Hot lead terdeteksi"
            checked={settings.notifyHotLead}
            onChange={(v) => patch({ notifyHotLead: v })}
          />
          <ToggleRow
            label="Perubahan status proposal"
            checked={settings.notifyProposalStatus}
            onChange={(v) => patch({ notifyProposalStatus: v })}
          />
          <ToggleRow
            label="Ringkasan harian"
            checked={settings.notifyDailyDigest}
            onChange={(v) => patch({ notifyDailyDigest: v })}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={savePreferences}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Simpan preferensi
          </button>
          <span className="text-xs text-muted-foreground">
            Preferensi tersimpan pada perangkat ini.
          </span>
        </div>
      </SectionCard>

      {canManage ? (
        <SectionCard
          title="Admin Whitelist"
          description="Hanya email pada daftar ini yang bisa mendapat akses /admin. Pendaftaran publik dinonaktifkan."
        >
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              addMutation.mutate();
            }}
          >
            <input
              type="email"
              required
              value={email}
              placeholder="nama@kerjaku.space"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none transition focus:border-primary/60"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              className="w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none transition focus:border-primary/60"
            >
              {WORKSPACE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" /> Tambah
            </button>
          </form>

          <p className="mt-2 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>

          <div className="mt-4 -mx-2 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(members.data ?? []).map((member) => (
                  <tr key={member.id} className="border-t border-border/30">
                    <td className="max-w-[16rem] truncate px-2 py-2.5">{member.email}</td>
                    <td className="px-2 py-2.5">
                      <Chip
                        className={roleBadgeClass(
                          isWorkspaceRole(member.role) ? member.role : null,
                        )}
                      >
                        {isWorkspaceRole(member.role) ? ROLE_LABELS[member.role] : member.role}
                      </Chip>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate(member.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border/50 px-2 py-1 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" /> Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {members.data && members.data.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">Belum ada anggota.</p>
          ) : null}
        </SectionCard>
      ) : (
        <SectionCard title="Admin Whitelist" description="Hanya Owner/Admin yang bisa mengelola tim.">
          <p className="text-xs text-muted-foreground">
            Role kamu ({currentRole ? ROLE_LABELS[currentRole] : "—"}) tidak memiliki izin mengubah
            daftar akses.
          </p>
        </SectionCard>
      )}

      <SectionCard title="Sesi" description="Keluar dari Business OS pada perangkat ini.">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={signOut}
            className="rounded-xl border border-border/60 px-4 py-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            Logout
          </button>
          <button
            type="button"
            onClick={signOutFully}
            className="rounded-xl border border-destructive/40 px-4 py-2 text-sm text-destructive transition hover:bg-destructive/10"
          >
            Keluar total
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Logout biasa menjaga buka cepat sidik jari tetap aktif di perangkat ini. Keluar total
          mematikan sidik jari dan mengakhiri sesi di semua perangkat.
        </p>
      </SectionCard>
    </div>
  );
}
