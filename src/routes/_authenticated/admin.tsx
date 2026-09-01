import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Bot,
  Brain,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  FileText,
  KanbanSquare,
  Receipt,
  Building2,
  UsersRound,
  FolderKanban,
  Images,
  Workflow,
  X,
  MessagesSquare,
} from "lucide-react";
import { useEffect, useState } from "react";

import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { getAdminAccess } from "@/lib/admin.functions";
import { signOutKeepingQuickUnlock } from "@/lib/auth/biometric-unlock";
import {
  ROLE_LABELS,
  isWorkspaceRole,
  roleBadgeClass,
  type WorkspaceRole,
} from "@/lib/admin/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Business OS — KERJAKU" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", exact: true, icon: LayoutDashboard },
  { to: "/admin/leads", label: "AI Lead CRM", exact: false, icon: Users },
  { to: "/admin/prospects", label: "Prospects", exact: false, icon: Target },
  { to: "/admin/pipeline", label: "Pipeline", exact: false, icon: KanbanSquare },
  { to: "/admin/proposals", label: "Proposals", exact: false, icon: FileText },
  { to: "/admin/invoices", label: "Payments", exact: false, icon: Receipt },
  { to: "/admin/clients", label: "Clients", exact: false, icon: Building2 },
  { to: "/admin/projects", label: "Projects", exact: false, icon: FolderKanban },
  { to: "/admin/portfolio", label: "Portfolio", exact: false, icon: Images },
  { to: "/admin/automation", label: "Automation", exact: false, icon: Workflow },
  { to: "/admin/conversations", label: "AI Conversations", exact: false, icon: MessagesSquare },
  { to: "/admin/assistant", label: "AI Assistant", exact: false, icon: Bot },
  { to: "/admin/memory", label: "AI Memory", exact: false, icon: Brain },
  { to: "/admin/team", label: "Team", exact: false, icon: UsersRound },
  { to: "/admin/analytics", label: "Analytics", exact: false, icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", exact: false, icon: Settings },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useServerFn(getAdminAccess);
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    void access()
      .then((result) => {
        if (!active) return;
        setRole(isWorkspaceRole(result.role) ? result.role : null);
        setState(result.hasAccess ? "ok" : "denied");
      })
      .catch(() => {
        if (active) setState("denied");
      });
    return () => {
      active = false;
    };
  }, [access]);


  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOutKeepingQuickUnlock();
    navigate({ to: "/auth", replace: true });
  }

  const navList = (
    <nav className="flex flex-col gap-1">
      {role ? (
        <span
          className={cn(
            "mb-2 inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.18em]",
            roleBadgeClass(role),
          )}
        >
          {ROLE_LABELS[role]}
        </span>
      ) : null}
      {NAV.map((item) => (

        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact }}
          activeProps={{ className: "bg-primary/15 text-primary" }}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/20 hover:text-foreground"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
      <button
        type="button"
        onClick={signOut}
        className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/20 hover:text-foreground"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span>Logout</span>
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-abyss text-foreground">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/40 bg-background/70 px-4 py-3 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          aria-label="Buka menu"
          onClick={() => setMenuOpen(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/50"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Link to="/admin" className="min-w-0 shrink-0 truncate text-sm font-semibold tracking-tight">
          KERJAKU
        </Link>
        <div className="ml-auto flex min-w-0 flex-1 items-center gap-2">
          <GlobalSearch />
          <NotificationBell />
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 border-r border-border/40 bg-card/90 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold tracking-tight">KERJAKU OS</span>
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setMenuOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {navList}
          </aside>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-[110rem]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-border/40 bg-card/30 p-4 backdrop-blur-xl lg:flex">
          <Link to="/admin" className="px-2 py-1 text-sm font-semibold tracking-tight">
            KERJAKU <span className="block text-xs text-muted-foreground">Business OS</span>
          </Link>
          {navList}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 hidden items-center gap-3 border-b border-border/40 bg-background/60 px-6 py-3 backdrop-blur-xl lg:flex lg:px-8">
            <div className="min-w-0 max-w-xl flex-1">
              <GlobalSearch />
            </div>
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>
        <main className={cn("min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8")}>
          {state === "loading" ? (
            <p className="text-sm text-muted-foreground">Memuat workspace…</p>
          ) : state === "denied" ? (
            <div className="rounded-3xl border border-border/40 bg-card/40 p-8 backdrop-blur-xl">
              <h1 className="text-lg font-semibold">Akses ditolak</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Akun ini belum memiliki role admin KERJAKU.
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        </div>
      </div>
    </div>
  );
}
