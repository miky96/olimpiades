import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { hasRole, useAuth } from "@/features/auth/AuthContext";
import { useSeasons } from "@/features/seasons/SeasonContext";
import { Button } from "@/ui/forms";
const navItems = [
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
    const visibleItems = navItems.filter((item) => !item.roles || hasRole(appUser, item.roles));
    async function handleLogout() {
        await signOutUser();
        navigate("/login", { replace: true });
    }
    return (_jsxs("div", { className: "flex min-h-full flex-col", children: [_jsxs("header", { className: "border-b border-slate-200 bg-white", children: [_jsxs("div", { className: "mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3", children: [_jsx(Link, { to: "/", className: "text-lg font-semibold", children: "Olimp\u00EDades" }), _jsxs("div", { className: "flex items-center gap-3 text-sm", children: [seasons.length > 0 ? (_jsx("select", { value: currentSeason?.id ?? "", onChange: (e) => selectSeason(e.target.value), className: "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm", title: "Temporada", children: seasons.map((s) => (_jsxs("option", { value: s.id, children: [s.name, s.status === "active" ? " (activa)" : ""] }, s.id))) })) : null, firebaseUser && appUser ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "hidden text-xs text-slate-500 md:inline", children: [appUser.email, " \u00B7 ", appUser.role] }), _jsx(Button, { variant: "ghost", onClick: handleLogout, children: "Surt" })] })) : (_jsx(Link, { to: "/login", className: "text-slate-700 hover:text-slate-900", children: "Entra" }))] })] }), _jsx("nav", { className: "mx-auto flex max-w-4xl gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2 text-sm", children: visibleItems.map((item) => (_jsx(NavLink, { to: item.to, className: ({ isActive }) => isActive
                                ? "whitespace-nowrap font-semibold text-slate-900"
                                : "whitespace-nowrap text-slate-600 hover:text-slate-900", children: item.label }, item.to))) })] }), _jsx("main", { className: "mx-auto w-full max-w-4xl flex-1 px-4 py-6", children: _jsx(Outlet, {}) })] }));
}
