import { useMemo, useState, type FormEvent } from "react";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { matchesRepo, teamsRepo, eventsRepo } from "@/data";
import type { Participant, Team } from "@/domain/types";
import { competition } from "@/domain";
import { useSeasons } from "@/features/seasons/SeasonContext";
import type { EventData } from "../EventDetailPage";

interface Props {
  data: EventData;
  readOnly: boolean;
  onChanged: () => Promise<void> | void;
}

export function TeamsTab({ data, readOnly, onChanged }: Props) {
  const { currentSeason } = useSeasons();
  const { event, teams, participants } = data;
  const seasonId = currentSeason?.id ?? "";
  const isDraft = event.status === "draft";
  const canEdit = !readOnly && isDraft;

  const [newName, setNewName] = useState("");
  const [newParticipantIds, setNewParticipantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [initBusy, setInitBusy] = useState(false);

  const participantById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  const assignedIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) for (const pid of t.participantIds) set.add(pid);
    return set;
  }, [teams]);

  const availableParticipants = participants.filter(
    (p) => p.active && !assignedIds.has(p.id)
  );

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!canEdit) return;
    const name = newName.trim();
    if (!name) {
      setFormError("Dona un nom a l'equip.");
      return;
    }
    setSaving(true);
    try {
      await teamsRepo.create(seasonId, event.id, {
        name,
        participantIds: newParticipantIds,
      });
      setNewName("");
      setNewParticipantIds([]);
      await onChanged();
    } catch (err) {
      console.error(err);
      setFormError("No s'ha pogut crear l'equip.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameTeam(team: Team) {
    if (!canEdit) return;
    const next = window.prompt("Nou nom de l'equip:", team.name);
    if (!next || next.trim() === team.name) return;
    try {
      await teamsRepo.update(seasonId, event.id, team.id, { name: next.trim() });
      await onChanged();
    } catch (err) {
      console.error(err);
      window.alert("No s'ha pogut canviar el nom.");
    }
  }

  async function handleRemoveTeam(team: Team) {
    if (!canEdit) return;
    const ok = window.confirm(`Eliminar l'equip "${team.name}"?`);
    if (!ok) return;
    try {
      await teamsRepo.remove(seasonId, event.id, team.id);
      await onChanged();
    } catch (err) {
      console.error(err);
      window.alert("No s'ha pogut eliminar l'equip.");
    }
  }

  async function handleAddMember(team: Team, participantId: string) {
    if (!canEdit) return;
    if (team.participantIds.includes(participantId)) return;
    try {
      await teamsRepo.update(seasonId, event.id, team.id, {
        participantIds: [...team.participantIds, participantId],
      });
      await onChanged();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveMember(team: Team, participantId: string) {
    if (!canEdit) return;
    try {
      await teamsRepo.update(seasonId, event.id, team.id, {
        participantIds: team.participantIds.filter((id) => id !== participantId),
      });
      await onChanged();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleInitCompetition() {
    if (!canEdit) return;
    setInitError(null);
    const eligibleTeams = teams.filter((t) => t.participantIds.length > 0);
    if (eligibleTeams.length < 2) {
      setInitError("Es necessiten com a mínim 2 equips amb participants.");
      return;
    }
    if (event.format === "single_match" && eligibleTeams.length !== 2) {
      setInitError("El format \"Partit únic\" requereix exactament 2 equips.");
      return;
    }
    if (event.format === "group_stage_bracket" && eligibleTeams.length < 4) {
      setInitError(
        "El format \"Lligueta + bracket\" necessita almenys 4 equips."
      );
      return;
    }
    const ok = window.confirm(
      "Iniciar la competició? Un cop iniciada, els equips queden bloquejats."
    );
    if (!ok) return;
    setInitBusy(true);
    try {
      const result = competition.initCompetition(event.format, {
        eventId: event.id,
        teamIds: eligibleTeams.map((t) => t.id),
        config: event.config,
      });
      // Assignem groupId a cada equip quan és group_stage_bracket.
      if (event.format === "group_stage_bracket" && result.groups) {
        for (const g of result.groups) {
          for (const tid of g.teamIds) {
            await teamsRepo.update(seasonId, event.id, tid, { groupId: g.id });
          }
        }
      }
      await matchesRepo.bulkCreate(seasonId, event.id, result.matches);
      await eventsRepo.update(seasonId, event.id, { status: "in_progress" });
      await onChanged();
    } catch (err) {
      console.error(err);
      setInitError(
        err instanceof Error ? err.message : "No s'ha pogut iniciar la competició."
      );
    } finally {
      setInitBusy(false);
    }
  }

  async function handleResetCompetition() {
    if (readOnly || event.status !== "in_progress") return;
    const ok = window.confirm(
      "Reiniciar la competició? S'eliminaran tots els partits i podràs canviar els equips."
    );
    if (!ok) return;
    try {
      await matchesRepo.clearAll(seasonId, event.id);
      await eventsRepo.update(seasonId, event.id, { status: "draft" });
      await onChanged();
    } catch (err) {
      console.error(err);
      window.alert("No s'ha pogut reiniciar la competició.");
    }
  }

  return (
    <div className="space-y-6">
      {canEdit ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Nou equip</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <Field label="Nom de l'equip">
              <Input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex. Equip A"
                required
              />
            </Field>
            {availableParticipants.length > 0 ? (
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">
                  Participants inicials (opcional)
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableParticipants.map((p) => {
                    const selected = newParticipantIds.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() =>
                          setNewParticipantIds((prev) =>
                            prev.includes(p.id)
                              ? prev.filter((id) => id !== p.id)
                              : [...prev, p.id]
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-xs ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              {formError ? <ErrorMessage>{formError}</ErrorMessage> : null}
              <Button type="submit" disabled={saving}>
                {saving ? "Creant…" : "Crear equip"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-6 py-3 text-sm font-semibold text-slate-900">
          Equips ({teams.length})
        </h2>
        {teams.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Encara no hi ha equips.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {teams.map((team) => (
              <li key={team.id} className="px-6 py-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{team.name}</p>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => handleRenameTeam(team)}>
                        Reanomenar
                      </Button>
                      <Button variant="danger" onClick={() => handleRemoveTeam(team)}>
                        Eliminar
                      </Button>
                    </div>
                  ) : null}
                </div>
                <TeamMembers
                  team={team}
                  participantById={participantById}
                  availableParticipants={availableParticipants}
                  canEdit={canEdit}
                  onAdd={(pid) => handleAddMember(team, pid)}
                  onRemove={(pid) => handleRemoveMember(team, pid)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && teams.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Iniciar competició</h2>
          <p className="mb-4 text-sm text-slate-600">
            Un cop iniciada, es generaran els partits i no podràs modificar els
            equips. Podràs reiniciar-la si cal.
          </p>
          {initError ? (
            <div className="mb-3"><ErrorMessage>{initError}</ErrorMessage></div>
          ) : null}
          <Button onClick={handleInitCompetition} disabled={initBusy}>
            {initBusy ? "Iniciant…" : "Iniciar competició"}
          </Button>
        </section>
      ) : null}

      {!readOnly && event.status === "in_progress" ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">
            Competició en curs
          </h2>
          <p className="mb-3 text-sm text-amber-800">
            Si cal, pots reiniciar la competició per tornar a configurar els equips.
          </p>
          <Button variant="danger" onClick={handleResetCompetition}>
            Reiniciar competició
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function TeamMembers({
  team,
  participantById,
  availableParticipants,
  canEdit,
  onAdd,
  onRemove,
}: {
  team: Team;
  participantById: Map<string, Participant>;
  availableParticipants: Participant[];
  canEdit: boolean;
  onAdd: (participantId: string) => void;
  onRemove: (participantId: string) => void;
}) {
  const [pickerValue, setPickerValue] = useState("");

  return (
    <div className="space-y-2">
      {team.participantIds.length === 0 ? (
        <p className="text-xs text-slate-500">Cap participant assignat.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {team.participantIds.map((pid) => {
            const p = participantById.get(pid);
            return (
              <li
                key={pid}
                className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-800"
              >
                <span>{p?.name ?? pid}</span>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onRemove(pid)}
                    className="ml-1 text-slate-500 hover:text-red-600"
                    aria-label="Treure participant"
                  >
                    ×
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && availableParticipants.length > 0 ? (
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
          >
            <option value="">Afegir participant…</option>
            {availableParticipants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pickerValue}
            onClick={() => {
              if (!pickerValue) return;
              onAdd(pickerValue);
              setPickerValue("");
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Afegir
          </button>
        </div>
      ) : null}
    </div>
  );
}
