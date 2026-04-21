import { useParams } from "react-router-dom";
import { PageHeader } from "@/ui/PageHeader";

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  return (
    <div>
      <PageHeader
        title={`Esdeveniment ${eventId ?? ""}`}
        description="Tabs: Assistència · Equips / Format · Resultats / Bracket."
      />
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Placeholder — aquí aniran les tres tabs de gestió de l'esdeveniment.
      </div>
    </div>
  );
}
