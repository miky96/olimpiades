import { Link, NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/classificacio", label: "Classificació" },
  { to: "/esdeveniments", label: "Esdeveniments" },
  { to: "/participants", label: "Participants" },
  { to: "/admin/usuaris", label: "Admins" },
];

export function AppLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            Olimpíades
          </Link>
          <nav className="hidden gap-4 text-sm md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive
                    ? "font-semibold text-slate-900"
                    : "text-slate-600 hover:text-slate-900"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">
            Entra
          </Link>
        </div>
        <nav className="flex gap-3 overflow-x-auto border-t border-slate-100 px-4 py-2 text-sm md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive
                  ? "whitespace-nowrap font-semibold text-slate-900"
                  : "whitespace-nowrap text-slate-600"
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
