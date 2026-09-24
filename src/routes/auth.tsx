import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getAdminAccess, provisionWorkspaceAccess } from "@/lib/admin.functions";
import {
  enrollBiometricUnlock,
  getEnrolledEmail,
  isBiometricSupported,
  syncStoredSession,
  unlockWithBiometric,
  type StoredSession,
} from "@/lib/auth/biometric-unlock";


export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Masuk — KERJAKU Business OS" },
      { name: "description", content: "Area internal KERJAKU. Khusus tim." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Masuk — KERJAKU Business OS" },
      { property: "og:description", content: "Area internal KERJAKU. Khusus tim." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const goNext = () => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) window.location.assign(next);
    else navigate({ to: "/admin", replace: true });
  };
  const provision = useServerFn(provisionWorkspaceAccess);
  const access = useServerFn(getAdminAccess);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  const [enrolledEmail, setEnrolledEmail] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [enrollOffer, setEnrollOffer] = useState<{ email: string; session: StoredSession } | null>(
    null,
  );

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) goNext();
    });
  }, [navigate]);

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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Grants the workspace role only when the account is on the approved team list.
      await provision().catch(() => undefined);

      const session = data.session;
      if (session?.refresh_token) {
        const stored: StoredSession = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        };
        if (enrolledEmail) {
          // Quick unlock already armed: silently re-arm with the fresh session.
          await syncStoredSession(stored);
        } else if (supported) {
          const role = await access()
            .then((r) => r.role)
            .catch(() => null);
          if (role === "owner") {
            setEnrollOffer({ email: data.user?.email ?? email, session: stored });
            setLoading(false);
            return;
          }
        }
      }

      goNext();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal masuk.");
    } finally {
      setLoading(false);
    }
  }

  async function onBiometricUnlock() {
    setUnlocking(true);
    setSessionExpired(false);
    try {
      const stored = await unlockWithBiometric();
      const { data, error } = await supabase.auth.setSession(stored);
      if (error || !data.session) {
        // Soft fallback: keep the fingerprint armed, just ask for the password once.
        setSessionExpired(true);
        if (enrolledEmail) setEmail(enrolledEmail);
        return;
      }
      if (data.session.refresh_token) {
        await syncStoredSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      await provision().catch(() => undefined);
      goNext();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // Cancelled or failed biometric prompt: stay quiet, form is right below.
      if (message) toast.error(message);
    } finally {
      setUnlocking(false);
    }
  }


  async function acceptEnroll() {
    if (!enrollOffer) return;
    try {
      await enrollBiometricUnlock(enrollOffer);
      toast.success("Buka cepat sidik jari aktif di perangkat ini.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pendaftaran biometrik gagal.");
    } finally {
      setEnrollOffer(null);
      goNext();
    }
  }

  if (enrollOffer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-abyss px-4 py-16">
        <div className="w-full max-w-sm rounded-3xl border border-border/40 bg-card/40 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/40 bg-primary/10">
            <Fingerprint className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-foreground">Aktifkan buka cepat?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lain kali cukup tap sidik jari untuk masuk ke workspace di perangkat ini. Password tetap
            bisa dipakai kapan saja.
          </p>
          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={acceptEnroll}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Aktifkan sidik jari
            </button>
            <button
              type="button"
              onClick={() => {
                setEnrollOffer(null);
                goNext();
              }}
              className="w-full rounded-xl border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Nanti saja
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-abyss px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-border/40 bg-card/40 p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-[0.65rem] uppercase tracking-[0.35em] text-muted-foreground">
          KERJAKU Business OS
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Masuk workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Area internal. Hanya akun tim yang sudah disetujui yang dapat masuk.
        </p>

        {supported && enrolledEmail ? (
          <div className="mt-6 space-y-3">
            {sessionExpired ? (
              <p className="rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                Sesi di perangkat ini sudah habis masa berlakunya. Masuk sekali dengan password —
                sidik jari akan aktif lagi otomatis setelahnya.
              </p>
            ) : null}

            <button
              type="button"
              onClick={onBiometricUnlock}
              disabled={unlocking}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              <Fingerprint className="h-5 w-5" />
              {unlocking ? "Memverifikasi…" : "Masuk dengan sidik jari"}
            </button>
            <p className="text-center text-xs text-muted-foreground">{enrolledEmail}</p>
            <div className="flex items-center gap-3 pt-1">
              <span className="h-px flex-1 bg-border/60" />
              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                atau password
              </span>
              <span className="h-px flex-1 bg-border/60" />
            </div>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/60"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/60"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Memproses…" : "Masuk"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Pendaftaran publik dinonaktifkan. Hubungi owner KERJAKU untuk mendapatkan akses.
        </p>
      </div>
    </main>
  );
}
