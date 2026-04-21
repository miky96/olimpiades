import { PageHeader } from "@/ui/PageHeader";

export function AdminUsersPage() {
  return (
    <div>
      <PageHeader
        title="Gestió d'admins"
        description="Només accessible per al superadmin — crear, bloquejar o eliminar admins."
      />
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Placeholder — llista d'admins amb accions de bloqueig / eliminació.
      </div>
    </div>
  );
}
