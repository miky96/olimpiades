import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { hasRole, useAuth } from "@/features/auth/AuthContext";
import { useSeasons } from "@/features/seasons/SeasonContext";
import { Button } from "@/ui/forms";
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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            Olimpiades
          </Link>

          <div className="flex items-center gap-3 text-sm">
            {seasons.length > 0 ? (
              <select
                value={currentSeason?.id ?? ""}
                onChange={(e) => selectSeason(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                title="Temporada"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === "active" ? " (activa)" : ""}
                  </option>
                ))}
              </select>
            ) : null}

            {firebaseUser && appUser ? (
              <>
                <span className="hidden text-xs text-slate-500 md:inline">
                  {appUser.email} · {appUser.role}
                </span>
                <Button variant="ghost" onClick={handleLogout}>
                  Surt
                </Button>
              </>
            ) : (
              <Link to="/login" className="text-slate-700 hover:text-slate-900">
                Entra
              </Link>
            )}
          </div>
        </div>

        <nav className="mx-auto flex max-w-4xl gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2 text-sm">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive
                  ? "whitespace-nowrap font-semibold text-slate-900"
                  : "whitespace-nowrap text-slate-600 hover:text-slate-900"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
