import { createContext } from "react";
import type { User } from "firebase/auth";
import type { AppUser } from "@/domain/types";

/**
 * Estat exposat pel AuthProvider. Es manté en un fitxer separat perquè
 * tant el Provider com el hook `useAuth` hi puguin accedir sense trencar
 * la regla de Fast Refresh (només-components per fitxer de component).
 */
export interface AuthState {
  /** Usuari autenticat a Firebase Auth (o null si no n'hi ha). */
  firebaseUser: User | null;
  /** Perfil de l'app (rol, estat) carregat des de Firestore. Null si no és admin. */
  appUser: AppUser | null;
  /** True mentre es comprova l'estat inicial o es carrega el perfil. */
  loading: boolean;
  /** Error mostrat en el últim intent de login. */
  error: string | null;
  signIn(email: string, password: string): Promise<void>;
  signOutUser(): Promise<void>;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);
