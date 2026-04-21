import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase";
import { usersRepo } from "@/data";
import type { AppUser, Role } from "@/domain/types";

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

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscripció a l'estat d'auth de Firebase.
  useEffect(() => {
    const auth = getAuthInstance();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setAppUser(null);
        setLoading(false);
        return;
      }
      // Carreguem el perfil (rol) des de Firestore.
      try {
        const profile = await usersRepo.get(user.uid);
        setAppUser(profile);
      } catch (e) {
        console.error("No s'ha pogut carregar el perfil d'usuari", e);
        setAppUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      appUser,
      loading,
      error,
      async signIn(email: string, password: string) {
        setError(null);
        setLoading(true);
        try {
          await signInWithEmailAndPassword(getAuthInstance(), email, password);
          // onAuthStateChanged carregarà el perfil.
        } catch (e) {
          setError(mapAuthError(e));
          setLoading(false);
          throw e;
        }
      },
      async signOutUser() {
        await signOut(getAuthInstance());
        setAppUser(null);
      },
    }),
    [firebaseUser, appUser, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

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

function mapAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Credencials incorrectes.";
    case "auth/invalid-email":
      return "L'email no és vàlid.";
    case "auth/too-many-requests":
      return "Massa intents. Torna-ho a provar en uns minuts.";
    case "auth/network-request-failed":
      return "Error de xarxa. Revisa la connexió.";
    default:
      return "No s'ha pogut iniciar sessió.";
  }
}
