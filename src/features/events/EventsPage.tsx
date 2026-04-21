import { PageHeader } from "@/ui/PageHeader";

export function EventsPage() {
  return (
    <div>
      <PageHeader
        title="Esdeveniments"
        description="Llista d'olimpíades de la temporada."
      />
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Placeholder — llista d'esdeveniments amb estat (draft / en curs / finalitzat).
      </div>
    </div>
  );
}
