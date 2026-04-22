import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasRole, useAuth } from "./AuthContext";
export function ProtectedRoute({ roles = ["admin", "superadmin"], }) {
    const { loading, firebaseUser, appUser } = useAuth();
    const location = useLocation();
    if (loading) {
        return (_jsx("div", { className: "py-12 text-center text-sm text-slate-500", children: "Comprovant sessi\u00F3\u2026" }));
    }
    if (!firebaseUser) {
        return (_jsx(Navigate, { to: "/login", state: { from: location.pathname }, replace: true }));
    }
    if (!hasRole(appUser, roles)) {
        return (_jsx("div", { className: "mx-auto max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900", children: "No tens permisos per accedir a aquesta p\u00E0gina." }));
    }
    return _jsx(Outlet, {});
}
