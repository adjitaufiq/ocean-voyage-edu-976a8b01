import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  budgetOptions,
  consultationSection,
  projectTypes,
  timelineOptions,
} from "@/lib/consultation-content";
import { consultationFormSchema, type ConsultationForm } from "@/lib/consultation-schema";
import { submitConsultationLead } from "@/lib/consultation.functions";
import { analytics } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";
import {
  getAiConsultation,
  getLeadTracking,
  type AiConsultationRecord,
} from "@/lib/lead-journey";
import { OceanButton } from "../OceanButton";
import { Reveal } from "../Reveal";

const empty: ConsultationForm = {
  name: "",
  email: "",
  whatsapp: "",
  projectType: "",
  requirement: "",
  budget: "",
  timeline: "",
  businessName: "",
  features: "",
  notes: "",
};

const fieldClass =
  "w-full rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none backdrop-blur-md transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60";
const labelClass = "block text-xs uppercase tracking-[0.18em] text-muted-foreground";

export function ConsultationStage() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ConsultationForm>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [mountedAt] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [aiRecord, setAiRecord] = useState<AiConsultationRecord | undefined>(undefined);
  const submit = useServerFn(submitConsultationLead);


  // Prefill from a completed AI consultation so the visitor never re-enters data.
  useEffect(() => {
    const ai = getAiConsultation();
    if (!ai) return;
    setAiRecord(ai);
    setValues((prev) => ({
      ...prev,
      requirement: prev.requirement || ai.summary,
      budget: prev.budget || ai.budget || "",
      timeline: prev.timeline || ai.timeline || "",
      features: prev.features || ai.requirements.join(", "),
    }));
  }, []);

  const set = (key: keyof ConsultationForm) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = consultationFormSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Periksa kembali data yang belum lengkap.");
      return;
    }

    setErrors({});
    setSending(true);
    try {
      const tracking = getLeadTracking();
      const ai = getAiConsultation();
      await submit({
        data: {
          form: parsed.data,
          tracking,
          ...(ai ? { ai } : {}),
          attribution: getAttribution(),
          leadSource: ai ? "ai_consultant" : "manual_form",
          honeypot,
          elapsedMs: Date.now() - mountedAt,
        },
      });

      analytics.consultationFormSubmit({
        project_type: parsed.data.projectType,
        budget: parsed.data.budget,
        timeline: parsed.data.timeline,
        lead_score: tracking.leadScore,
        lead_temperature: tracking.leadTemperature,
      });
      setDone(true);
      setValues(empty);
      toast.success("Konsultasi terkirim. KERJAKU akan menghubungi Anda.");
    } catch {
      toast.error("Gagal mengirim. Coba lagi beberapa saat lagi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="konsultasi" className="relative px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <div className="rounded-[2rem] glass-panel p-7 sm:p-9">
            <p className="text-[11px] uppercase tracking-[0.42em] text-primary/90">
              {consultationSection.eyebrow}
            </p>
            <h2 className="mt-5 font-display text-[clamp(1.8rem,4.6vw,2.8rem)] leading-tight">
              {consultationSection.title}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {consultationSection.body}
            </p>

            {aiRecord && !done && (
              <div className="mt-7 rounded-2xl border border-primary/40 bg-primary/[0.07] p-5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-primary/90">
                  Ringkasan AI Consultant
                </p>
                <p className="mt-3 text-sm text-foreground">
                  {aiRecord.businessCategory || "-"} · {aiRecord.packageName} ·{" "}
                  {aiRecord.qualification} ({aiRecord.score}/100)
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Masalah: {aiRecord.problems.join(", ") || "-"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Kebutuhan: {aiRecord.requirements.join(", ") || "-"}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Data ini otomatis terkirim bersama form, Anda tidak perlu mengulang input.
                </p>
              </div>
            )}

            {!open && (
              <OceanButton
                className="mt-8 w-full sm:w-60"
                onClick={() => {
                  analytics.consultationButtonClick("consultation_section", consultationSection.cta);
                  analytics.consultationFormOpen();
                  setOpen(true);
                }}
              >
                {consultationSection.cta}
              </OceanButton>
            )}

            {done && (
              <p className="mt-8 rounded-2xl border border-primary/40 bg-primary/10 px-5 py-4 text-sm text-foreground">
                Terima kasih. Permintaan konsultasi Anda sudah kami terima dan akan segera
                ditindaklanjuti.
              </p>
            )}

            {open && !done && (
              <form onSubmit={handleSubmit} className="mt-8 grid gap-5" noValidate>
                {/* Honeypot: hidden from users, filled only by bots. */}
                <input
                  type="text"
                  name="company_website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />

                <Field label="Nama Lengkap" error={errors["name"]}>
                  <input
                    className={fieldClass}
                    value={values.name}
                    onChange={(e) => set("name")(e.target.value)}
                    placeholder="Nama Anda"
                    autoComplete="name"
                  />
                </Field>

                <Field label="Email" error={errors["email"]}>
                  <input
                    className={fieldClass}
                    type="email"
                    value={values.email}
                    onChange={(e) => set("email")(e.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="email"
                  />
                </Field>

                <Field label="Nomor WhatsApp" error={errors["whatsapp"]}>
                  <input
                    className={fieldClass}
                    inputMode="tel"
                    value={values.whatsapp}
                    onChange={(e) => set("whatsapp")(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    autoComplete="tel"
                  />
                </Field>

                <Field label="Jenis Project" error={errors["projectType"]}>
                  <select
                    className={fieldClass}
                    value={values.projectType}
                    onChange={(e) => set("projectType")(e.target.value)}
                  >
                    <option value="">Pilih jenis project</option>
                    {projectTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Kebutuhan Project" error={errors["requirement"]}>
                  <textarea
                    className={`${fieldClass} min-h-32 resize-y`}
                    value={values.requirement}
                    onChange={(e) => set("requirement")(e.target.value)}
                    placeholder="Ceritakan masalah atau kebutuhan yang ingin diselesaikan"
                  />
                </Field>

                <Field label="Estimasi Budget" error={errors["budget"]}>
                  <select
                    className={fieldClass}
                    value={values.budget}
                    onChange={(e) => set("budget")(e.target.value)}
                  >
                    <option value="">Pilih estimasi budget</option>
                    {budgetOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Target Waktu" error={errors["timeline"]}>
                  <select
                    className={fieldClass}
                    value={values.timeline}
                    onChange={(e) => set("timeline")(e.target.value)}
                  >
                    <option value="">Pilih target waktu</option>
                    {timelineOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Nama Bisnis (opsional)" error={errors["businessName"]}>
                  <input
                    className={fieldClass}
                    value={values.businessName ?? ""}
                    onChange={(e) => set("businessName")(e.target.value)}
                    placeholder="Nama bisnis atau brand"
                  />
                </Field>

                <Field label="Fitur yang Diinginkan (opsional)" error={errors["features"]}>
                  <textarea
                    className={`${fieldClass} min-h-24 resize-y`}
                    value={values.features ?? ""}
                    onChange={(e) => set("features")(e.target.value)}
                    placeholder="Contoh: dashboard admin, laporan otomatis"
                  />
                </Field>

                <Field label="Catatan Tambahan (opsional)" error={errors["notes"]}>
                  <textarea
                    className={`${fieldClass} min-h-24 resize-y`}
                    value={values.notes ?? ""}
                    onChange={(e) => set("notes")(e.target.value)}
                    placeholder="Informasi lain yang perlu diketahui"
                  />
                </Field>

                <OceanButton type="submit" className="w-full sm:w-60" disabled={sending}>
                  {sending ? "Mengirim…" : "Kirim Konsultasi"}
                </OceanButton>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <span className="mt-2 block">{children}</span>
      {error && <span className="mt-1.5 block text-xs text-destructive">{error}</span>}
    </label>
  );
}
