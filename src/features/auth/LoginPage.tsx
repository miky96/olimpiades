import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { useAuth } from "./useAuth";

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
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center">
      <div className="mb-6 text-center">
        <div
          aria-hidden
          className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <circle cx="6" cy="10" r="3.2" />
            <circle cx="18" cy="10" r="3.2" />
            <circle cx="12" cy="10" r="3.2" />
            <path d="M3 17h18" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Benvingut de nou
        </h1>
        <p className="mt-1 text-sm muted">
          Accés reservat a admins i superadmins.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="card card-pad space-y-4 animate-fade-in"
      >
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nom@example.com"
          />
        </Field>
        <Field label="Contrasenya">
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        {firebaseUser && !appUser && !loading ? (
          <ErrorMessage>
            Aquest usuari no té permisos. Demana al superadmin que et doni d'alta.
          </ErrorMessage>
        ) : null}
        <Button
          type="submit"
          disabled={submitting || loading}
          size="lg"
          className="w-full"
        >
          {submitting || loading ? "Entrant…" : "Entra"}
        </Button>
      </form>
    </div>
  );
}
