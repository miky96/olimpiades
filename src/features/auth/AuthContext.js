import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState, } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, } from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase";
import { usersRepo } from "@/data";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [appUser, setAppUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
            }
            catch (e) {
                console.error("No s'ha pogut carregar el perfil d'usuari", e);
                setAppUser(null);
            }
            finally {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);
    const value = useMemo(() => ({
        firebaseUser,
        appUser,
        loading,
        error,
        async signIn(email, password) {
            setError(null);
            setLoading(true);
            try {
                await signInWithEmailAndPassword(getAuthInstance(), email, password);
                // onAuthStateChanged carregarà el perfil.
            }
            catch (e) {
                setError(mapAuthError(e));
                setLoading(false);
                throw e;
            }
        },
        async signOutUser() {
            await signOut(getAuthInstance());
            setAppUser(null);
        },
    }), [firebaseUser, appUser, loading, error]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth s'ha de cridar dins d'un <AuthProvider>");
    }
    return ctx;
}
/** Helper per comprovar si l'usuari autenticat té un rol determinat i està actiu. */
export function hasRole(appUser, roles) {
    if (!appUser)
        return false;
    if (appUser.status !== "active")
        return false;
    return roles.includes(appUser.role);
}
function mapAuthError(e) {
    const code = e?.code ?? "";
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
