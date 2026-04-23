import {
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
import type { AppUser } from "@/domain/types";
import { AuthContext, type AuthState } from "./auth-context";

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
