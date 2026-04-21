import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "@/domain/types";
import { hasRole, useAuth } from "./AuthContext";

interface ProtectedRouteProps {
  /** Rols autoritzats. Per defecte: admin i superadmin. */
  roles?: Role[];
}

export function ProtectedRoute({
  roles = ["admin", "superadmin"],
}: ProtectedRouteProps) {
  const { loading, firebaseUser, appUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Comprovant sessió…
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  if (!hasRole(appUser, roles)) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        No tens permisos per accedir a aquesta pàgina.
      </div>
    );
  }

  return <Outlet />;
}
