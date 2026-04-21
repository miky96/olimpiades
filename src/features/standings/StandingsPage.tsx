import { PageHeader } from "@/ui/PageHeader";

export function StandingsPage() {
  return (
    <div>
      <PageHeader
        title="Classificació general"
        description="Rànquing acumulat de la temporada actual."
      />
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Placeholder — aquí es mostrarà la classificació agregada a partir de
        les posicions finals de cada esdeveniment.
      </div>
    </div>
  );
}
