import { useState, type FormEvent } from "react";
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
    const redirectTo =
      (location.state as { from?: string } | null)?.from ?? "/classificacio";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(
        (location.state as { from?: string } | null)?.from ?? "/classificacio",
        { replace: true }
      );
    } catch {
      // l'error ja es mostra via `error` del context
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <PageHeader title="Entra" description="Accés per a admins i superadmin." />
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Contrasenya">
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        {firebaseUser && !appUser && !loading ? (
          <ErrorMessage>
            Aquest usuari no té permisos. Demana al superadmin que et doni d'alta.
          </ErrorMessage>
        ) : null}
        <Button type="submit" disabled={submitting || loading} className="w-full">
          {submitting || loading ? "Entrant…" : "Entra"}
        </Button>
      </form>
    </div>
  );
}
