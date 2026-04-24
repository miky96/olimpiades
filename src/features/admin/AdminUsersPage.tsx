import { PageHeader } from "@/ui/PageHeader";

export function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Superadmin"
        title="Gestió d'admins"
        description="Crear, bloquejar o eliminar admins. Només accessible per al superadmin."
      />
      <div className="card card-pad flex flex-col items-center gap-3 text-center">
        <div
          aria-hidden
          className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
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
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 11v6" />
            <path d="M19 14h6" />
          </svg>
        </div>
        <p className="text-sm muted">
          Pròximament — llista d'admins amb accions de bloqueig i eliminació.
        </p>
      </div>
    </div>
  );
}
