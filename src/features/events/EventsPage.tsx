import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/ui/PageHeader";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { eventsRepo } from "@/data";
import type { EventFormat, OlimpiadaEvent } from "@/domain/types";
import { formatLabels } from "@/domain/formatLabels";
import { useSeasons } from "@/features/seasons/useSeasons";
import { useAuth, hasRole } from "@/features/auth/useAuth";

const FORMATS: EventFormat[] = ["single_match", "bracket", "group_stage_bracket"];

export function EventsPage() {
  const { currentSeason } = useSeasons();
  const { appUser } = useAuth();
  const canWrite = hasRole(appUser, ["admin", "superadmin"]);
  const isArchived = currentSeason?.status === "archived";

  const [events, setEvents] = useState<OlimpiadaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState<EventFormat>("bracket");
  const [groupSize, setGroupSize] = useState<3 | 4>(4);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentSeason) return;
    setLoading(true);
    setError(null);
    try {
      const list = await eventsRepo.list(currentSeason.id);
      setEvents(list);
    } catch (e) {
      console.error(e);
      setError("No s'han pogut carregar els esdeveniments.");
    } finally {
      setLoading(false);
    }
  }, [currentSeason]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentSeason) {
    return (
      <div>
        <PageHeader title="Esdeveniments" />
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Cap temporada seleccionada. Crea'n una a <em>Temporades</em>.
        </div>
      </div>
    );
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite || !currentSeason) return;
    setFormError(null);
    const trimmedSport = sport.trim();
    if (!trimmedSport) {
      setFormError("Indica l'esport.");
      return;
    }
    setCreating(true);
    try {
      const payload: Parameters<typeof eventsRepo.create>[1] = {
        sport: trimmedSport,
        date,
        format,
        status: "draft",
        config:
          format === "group_stage_bracket"
            ? { groupSize, qualifiersPerGroup: 2 }
            : {},
      };
      const trimmedName = name.trim();
      if (trimmedName) payload.name = trimmedName;
      await eventsRepo.create(currentSeason.id, payload);
      setName("");
      setSport("");
      await load();
    } catch (err) {
      console.error(err);
      setFormError("No s'ha pogut crear l'esdeveniment.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(ev: OlimpiadaEvent) {
    if (!canWrite || !currentSeason) return;
    if (ev.status !== "draft") {
      window.alert(
        "Només es poden eliminar esdeveniments en esborrany. Els que ja han començat s'han de finalitzar."
      );
      return;
    }
    const ok = window.confirm(
      `Eliminar l'esdeveniment "${ev.name || ev.sport}"? Aquesta acció és irreversible.`
    );
    if (!ok) return;
    try {
      await eventsRepo.remove(currentSeason.id, ev.id);
      await load();
    } catch (err) {
      console.error(err);
      window.alert("No s'ha pogut eliminar l'esdeveniment.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Esdeveniments"
        description={`Temporada: ${currentSeason.name}${isArchived ? " (arxivada, només lectura)" : ""}`}
      />

      {canWrite && !isArchived ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Nou esdeveniment</h2>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
            <Field label="Esport">
              <Input
                type="text"
                required
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                placeholder="Ex. Ping-pong"
              />
            </Field>
            <Field label="Nom (opcional)">
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Torneig de primavera"
              />
            </Field>
            <Field label="Data">
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Format">
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                value={format}
                onChange={(e) => setFormat(e.target.value as EventFormat)}
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {formatLabels[f]}
                  </option>
                ))}
              </select>
            </Field>
            {format === "group_stage_bracket" ? (
              <Field label="Mida de grup">
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value) as 3 | 4)}
                >
                  <option value={3}>3 equips per grup</option>
                  <option value={4}>4 equips per grup</option>
                </select>
              </Field>
            ) : null}
            <div className="md:col-span-2 flex items-center justify-end gap-3">
              {formError ? <ErrorMessage>{formError}</ErrorMessage> : null}
              <Button type="submit" disabled={creating}>
                {creating ? "Creant…" : "Crear"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-6 py-3 text-sm font-semibold text-slate-900">
          Llista ({events.length})
        </h2>
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Carregant…</p>
        ) : error ? (
          <div className="p-6"><ErrorMessage>{error}</ErrorMessage></div>
        ) : events.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Encara no hi ha esdeveniments.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {ev.name ? `${ev.name} · ` : ""}
                    {ev.sport}
                  </p>
                  <p className="text-xs text-slate-500">
                    {ev.date} · {formatLabels[ev.format]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={ev.status} />
                  <Link
                    to={`/esdeveniments/${ev.id}`}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                  >
                    Obrir
                  </Link>
                  {canWrite && !isArchived && ev.status === "draft" ? (
                    <Button variant="danger" onClick={() => handleRemove(ev)}>
                      Eliminar
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: OlimpiadaEvent["status"] }) {
  const styles: Record<OlimpiadaEvent["status"], string> = {
    draft: "bg-slate-100 text-slate-700",
    in_progress: "bg-amber-100 text-amber-800",
    finished: "bg-emerald-100 text-emerald-800",
  };
  const labels: Record<OlimpiadaEvent["status"], string> = {
    draft: "Esborrany",
    in_progress: "En curs",
    finished: "Finalitzat",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
