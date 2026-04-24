import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { hasRole, useAuth } from "@/features/auth/useAuth";
import { useSeasons } from "@/features/seasons/useSeasons";
import { Button, Select } from "@/ui/forms";
import type { Role } from "@/domain/types";

interface NavItem {
  to: string;
  label: string;
  /** Rols que poden veure aquest ítem. Si és undefined, és públic. */
  roles?: Role[];
}

const navItems: NavItem[] = [
  { to: "/classificacio", label: "Classificació" },
  { to: "/esdeveniments", label: "Esdeveniments", roles: ["admin", "superadmin"] },
  { to: "/participants", label: "Participants", roles: ["admin", "superadmin"] },
  { to: "/admin/temporades", label: "Temporades", roles: ["superadmin"] },
  { to: "/admin/usuaris", label: "Admins", roles: ["superadmin"] },
];

export function AppLayout() {
  const { firebaseUser, appUser, signOutUser } = useAuth();
  const { currentSeason, seasons, selectSeason } = useSeasons();
  const navigate = useNavigate();

  const visibleItems = navItems.filter(
    (item) => !item.roles || hasRole(appUser, item.roles)
  );

  async function handleLogout() {
    await signOutUser();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="group flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <circle cx="6" cy="10" r="3.2" />
                <circle cx="18" cy="10" r="3.2" />
                <circle cx="12" cy="10" r="3.2" />
                <path d="M3 17h18" />
              </svg>
            </span>
            <span className="bg-gradient-to-r from-slate-900 to-brand-700 bg-clip-text text-transparent dark:from-white dark:to-brand-300">
              Olimpiades
            </span>
          </Link>

          <div className="flex items-center gap-2 text-sm">
            {seasons.length > 0 ? (
              <Select
                value={currentSeason?.id ?? ""}
                onChange={(e) => selectSeason(e.target.value)}
                className="h-9 w-auto min-w-[8rem] py-0 text-xs sm:text-sm"
                title="Temporada"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === "active" ? " · activa" : ""}
                  </option>
                ))}
              </Select>
            ) : null}

            {firebaseUser && appUser ? (
              <>
                <span
                  title={`${appUser.email} · ${appUser.role}`}
                  className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 md:inline"
                >
                  {appUser.email.split("@")[0]} · {appUser.role}
                </span>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Surt
                </Button>
              </>
            ) : (
              <Link to="/login" className="link text-sm">
                Entra
              </Link>
            )}
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2 text-sm sm:px-5">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-600 text-white shadow-sm dark:bg-brand-500"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 animate-fade-in px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-600">
        Made by Miky
      </footer>
    </div>
  );
}
