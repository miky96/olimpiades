import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/ui/PageHeader";
import { Badge, Button, ErrorMessage, Field, Input, Select } from "@/ui/forms";
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
      <div className="space-y-6">
        <PageHeader title="Esdeveniments" />
        <div className="card card-pad text-sm muted">
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
        eyebrow={currentSeason.name}
        title="Esdeveniments"
        description={
          isArchived
            ? "Temporada arxivada — només lectura."
            : `${events.length} esdeveniment${events.length === 1 ? "" : "s"} programat${events.length === 1 ? "" : "s"}.`
        }
      />

      {canWrite && !isArchived ? (
        <section className="card card-pad">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest muted">
            Nou esdeveniment
          </h2>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
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
              <Select
                value={format}
                onChange={(e) => setFormat(e.target.value as EventFormat)}
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {formatLabels[f]}
                  </option>
                ))}
              </Select>
            </Field>
            {format === "group_stage_bracket" ? (
              <Field label="Mida de grup">
                <Select
                  value={groupSize}
                  onChange={(e) =>
                    setGroupSize(Number(e.target.value) as 3 | 4)
                  }
                >
                  <option value={3}>3 equips per grup</option>
                  <option value={4}>4 equips per grup</option>
                </Select>
              </Field>
            ) : null}
            <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3">
              {formError ? <ErrorMessage>{formError}</ErrorMessage> : null}
              <Button type="submit" disabled={creating}>
                {creating ? "Creant…" : "Crear"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card">
        <div className="card-header">
          <span>Llista ({events.length})</span>
        </div>
        {loading ? (
          <p className="p-6 text-sm muted">Carregant…</p>
        ) : error ? (
          <div className="p-6">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        ) : events.length === 0 ? (
          <p className="p-6 text-sm muted">Encara no hi ha esdeveniments.</p>
        ) : (
          <ul className="card-divide">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {ev.name ? `${ev.name} · ` : ""}
                      {ev.sport}
                    </p>
                    <StatusBadge status={ev.status} />
                  </div>
                  <p className="mt-0.5 text-xs subtle">
                    {ev.date} · {formatLabels[ev.format]}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Link
                    to={`/esdeveniments/${ev.id}`}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Obrir
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                  {canWrite && !isArchived && ev.status === "draft" ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemove(ev)}
                    >
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
  const config: Record<
    OlimpiadaEvent["status"],
    { tone: "slate" | "amber" | "emerald"; label: string }
  > = {
    draft: { tone: "slate", label: "Esborrany" },
    in_progress: { tone: "amber", label: "En curs" },
    finished: { tone: "emerald", label: "Finalitzat" },
  };
  const c = config[status];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}
