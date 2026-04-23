import { useContext } from "react";
import { AuthContext, type AuthState } from "./auth-context";
import type { AppUser, Role } from "@/domain/types";

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth s'ha de cridar dins d'un <AuthProvider>");
  }
  return ctx;
}

/** Helper per comprovar si l'usuari autenticat té un rol determinat i està actiu. */
export function hasRole(appUser: AppUser | null, roles: Role[]): boolean {
  if (!appUser) return false;
  if (appUser.status !== "active") return false;
  return roles.includes(appUser.role);
}
