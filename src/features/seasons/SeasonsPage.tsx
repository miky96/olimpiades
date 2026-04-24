import { useState, type FormEvent } from "react";
import { PageHeader } from "@/ui/PageHeader";
import { Badge, Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { seasonsRepo } from "@/data";
import { useSeasons } from "./useSeasons";

export function SeasonsPage() {
  const { seasons, currentSeason, loading, error, refresh, selectSeason } =
    useSeasons();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const hasActive = seasons.some((s) => s.status === "active");

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (hasActive) {
      setFormError(
        "Ja hi ha una temporada activa. Arxiva-la abans de crear-ne una de nova."
      );
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
        eyebrow="Superadmin"
        title="Temporades"
        description="Només els superadmin poden crear o arxivar temporades."
      />

      <section className="card card-pad">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest muted">
          Nova temporada
        </h2>
        <form
          onSubmit={handleCreate}
          className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end"
        >
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
        {formError ? (
          <div className="mt-4">
            <ErrorMessage>{formError}</ErrorMessage>
          </div>
        ) : null}
        {hasActive ? (
          <p className="mt-3 text-xs subtle">
            Només pot haver-hi una temporada activa a la vegada.
          </p>
        ) : null}
      </section>

      <section className="card">
        <div className="card-header">
          <span>Llista ({seasons.length})</span>
        </div>
        {loading ? (
          <p className="p-6 text-sm muted">Carregant…</p>
        ) : error ? (
          <div className="p-6">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        ) : seasons.length === 0 ? (
          <p className="p-6 text-sm muted">
            Encara no hi ha cap temporada. Crea la primera aquí a sobre.
          </p>
        ) : (
          <ul className="card-divide">
            {seasons.map((s) => {
              const isSelected = currentSeason?.id === s.id;
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {s.name}
                      </p>
                      {s.status === "active" ? (
                        <Badge tone="emerald">Activa</Badge>
                      ) : (
                        <Badge tone="slate">Arxivada</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs subtle">
                      Inici: {s.startDate}
                      {s.endDate ? ` · Fi: ${s.endDate.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={isSelected ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => selectSeason(s.id)}
                    >
                      {isSelected ? "Seleccionada" : "Veure"}
                    </Button>
                    {s.status === "active" ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleArchive(s.id)}
                      >
                        Arxivar
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
