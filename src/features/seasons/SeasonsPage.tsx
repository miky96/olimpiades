import { useState, type FormEvent } from "react";
import { PageHeader } from "@/ui/PageHeader";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { seasonsRepo } from "@/data";
import { useSeasons } from "./useSeasons";

export function SeasonsPage() {
  const { seasons, currentSeason, loading, error, refresh, selectSeason } =
    useSeasons();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const hasActive = seasons.some((s) => s.status === "active");

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (hasActive) {
      setFormError("Ja hi ha una temporada activa. Arxiva-la abans de crear-ne una de nova.");
      return;
    }
    setCreating(true);
    try {
      await seasonsRepo.create({
        name: name.trim(),
        startDate,
        status: "active",
      });
      setName("");
      await refresh();
    } catch (err) {
      console.error(err);
      setFormError("No s'ha pogut crear la temporada.");
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(seasonId: string) {
    const ok = window.confirm(
      "Segur que vols arxivar aquesta temporada? Un cop arxivada no es pot editar."
    );
    if (!ok) return;
    try {
      await seasonsRepo.archive(seasonId, new Date().toISOString());
      await refresh();
      window.alert("Temporada arxivada. Fins a la pròxima!");
    } catch (err) {
      console.error(err);
      window.alert("No s'ha pogut arxivar la temporada.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Temporades"
        description="Només els superadmin poden crear o arxivar temporades."
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Nova temporada</h2>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <Field label="Nom">
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Temporada 2026 primavera"
            />
          </Field>
          <Field label="Data d'inici">
            <Input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={creating || hasActive}>
            {creating ? "Creant…" : "Crear"}
          </Button>
        </form>
        {formError ? <div className="mt-3"><ErrorMessage>{formError}</ErrorMessage></div> : null}
        {hasActive ? (
          <p className="mt-3 text-xs text-slate-500">
            Només pot haver-hi una temporada activa a la vegada.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-6 py-3 text-sm font-semibold text-slate-900">
          Llista
        </h2>
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Carregant…</p>
        ) : error ? (
          <div className="p-6"><ErrorMessage>{error}</ErrorMessage></div>
        ) : seasons.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            Encara no hi ha cap temporada. Crea la primera aquí a sobre.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {seasons.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    Inici: {s.startDate}
                    {s.endDate ? ` · Fi: ${s.endDate.slice(0, 10)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {s.status === "active" ? "Activa" : "Arxivada"}
                  </span>
                  <Button
                    variant={currentSeason?.id === s.id ? "primary" : "secondary"}
                    onClick={() => selectSeason(s.id)}
                  >
                    {currentSeason?.id === s.id ? "Seleccionada" : "Veure"}
                  </Button>
                  {s.status === "active" ? (
                    <Button variant="danger" onClick={() => handleArchive(s.id)}>
                      Arxivar
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
