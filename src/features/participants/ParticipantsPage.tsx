import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/ui/PageHeader";
import { Badge, Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { participantsRepo } from "@/data";
import type { Participant } from "@/domain/types";
import { useSeasons } from "@/features/seasons/useSeasons";
import { useAuth, hasRole } from "@/features/auth/useAuth";

export function ParticipantsPage() {
  const { currentSeason } = useSeasons();
  const { appUser } = useAuth();
  const canWrite = hasRole(appUser, ["admin", "superadmin"]);
  const isArchived = currentSeason?.status === "archived";

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!currentSeason) return;
    setLoading(true);
    setError(null);
    try {
      const list = await participantsRepo.list(currentSeason.id);
      list.sort((a, b) => a.name.localeCompare(b.name));
      setParticipants(list);
    } catch (e) {
      console.error(e);
      setError("No s'han pogut carregar els participants.");
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
        <PageHeader title="Participants" />
        <div className="card card-pad text-sm muted">
          Cap temporada seleccionada. Crea'n una a <em>Temporades</em>.
        </div>
      </div>
    );
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite || !currentSeason) return;
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await participantsRepo.create(currentSeason.id, { name, active: true });
      setNewName("");
      await load();
    } catch (e) {
      console.error(e);
      setError("No s'ha pogut crear el participant.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(p: Participant) {
    if (!canWrite || !currentSeason) return;
    try {
      await participantsRepo.update(currentSeason.id, p.id, {
        active: !p.active,
      });
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRename(p: Participant) {
    if (!canWrite || !currentSeason) return;
    const next = window.prompt("Nou nom:", p.name);
    if (!next || next.trim() === p.name) return;
    try {
      await participantsRepo.update(currentSeason.id, p.id, {
        name: next.trim(),
      });
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRemove(p: Participant) {
    if (!canWrite || !currentSeason) return;
    const ok = window.confirm(`Eliminar ${p.name}? Aquesta acció és irreversible.`);
    if (!ok) return;
    try {
      await participantsRepo.remove(currentSeason.id, p.id);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  const activeCount = participants.filter((p) => p.active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={currentSeason.name}
        title="Participants"
        description={`${activeCount} actius · ${participants.length} en total${
          isArchived ? " · temporada arxivada (només lectura)" : ""
        }`}
      />

      {canWrite && !isArchived ? (
        <section className="card card-pad">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest muted">
            Nou participant
          </h2>
          <form
            onSubmit={handleCreate}
            className="flex flex-wrap items-end gap-3"
          >
            <Field label="Nom" className="flex-1 min-w-[200px]">
              <Input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom i cognom"
              />
            </Field>
            <Button type="submit" disabled={creating}>
              {creating ? "Afegint…" : "Afegir"}
            </Button>
          </form>
        </section>
      ) : null}

      <section className="card">
        <div className="card-header">
          <span>Llista ({participants.length})</span>
        </div>
        {loading ? (
          <p className="p-6 text-sm muted">Carregant…</p>
        ) : error ? (
          <div className="p-6">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        ) : participants.length === 0 ? (
          <p className="p-6 text-sm muted">Encara no hi ha participants.</p>
        ) : (
          <ul className="card-divide">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className="truncate font-medium text-slate-900 dark:text-slate-100"
                      title={p.name}
                    >
                      {p.name}
                    </p>
                    {!p.active ? <Badge tone="slate">Inactiu</Badge> : null}
                  </div>
                </div>
                {canWrite && !isArchived ? (
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRename(p)}
                    >
                      Reanomenar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleActive(p)}
                    >
                      {p.active ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemove(p)}
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
