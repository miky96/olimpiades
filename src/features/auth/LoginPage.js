import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "@/ui/PageHeader";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { useAuth } from "./AuthContext";
export function LoginPage() {
    const { signIn, firebaseUser, appUser, loading, error } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    // Ja autenticat? redirigim.
    if (firebaseUser && appUser) {
        const redirectTo = location.state?.from ?? "/classificacio";
        return _jsx(Navigate, { to: redirectTo, replace: true });
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        try {
            await signIn(email, password);
            navigate(location.state?.from ?? "/classificacio", { replace: true });
        }
        catch {
            // l'error ja es mostra via `error` del context
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsxs("div", { className: "mx-auto max-w-sm", children: [_jsx(PageHeader, { title: "Entra", description: "Acc\u00E9s per a admins i superadmin." }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4 rounded-lg border border-slate-200 bg-white p-6", children: [_jsx(Field, { label: "Email", children: _jsx(Input, { type: "email", autoComplete: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value) }) }), _jsx(Field, { label: "Contrasenya", children: _jsx(Input, { type: "password", autoComplete: "current-password", required: true, value: password, onChange: (e) => setPassword(e.target.value) }) }), error ? _jsx(ErrorMessage, { children: error }) : null, firebaseUser && !appUser && !loading ? (_jsx(ErrorMessage, { children: "Aquest usuari no t\u00E9 permisos. Demana al superadmin que et doni d'alta." })) : null, _jsx(Button, { type: "submit", disabled: submitting || loading, className: "w-full", children: submitting || loading ? "Entrant…" : "Entra" })] })] }));
}
