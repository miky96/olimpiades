import { useMemo, useState, type FormEvent } from "react";
import { Badge, Button, ErrorMessage, Field, Input, Select } from "@/ui/forms";
import { matchesRepo, teamsRepo, eventsRepo } from "@/data";
import type { Participant, Team } from "@/domain/types";
import { competition } from "@/domain";
import { useSeasons } from "@/features/seasons/useSeasons";
import type { EventData } from "../EventDetailPage";
import { RandomTeamsGenerator } from "./RandomTeamsGenerator";

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
  const [groupAssignment, setGroupAssignment] = useState<"order" | "random">(
    "order"
  );

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
      setInitError('El format "Partit únic" requereix exactament 2 equips.');
      return;
    }
    if (event.format === "group_stage_bracket" && eligibleTeams.length < 4) {
      setInitError('El format "Lligueta + bracket" necessita almenys 4 equips.');
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
        rng:
          event.format === "group_stage_bracket" && groupAssignment === "random"
            ? Math.random
            : undefined,
      });
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
      {canEdit && teams.length === 0 ? (
        <RandomTeamsGenerator
          seasonId={seasonId}
          eventId={event.id}
          participants={participants}
          attendance={data.attendance}
          onGenerated={onChanged}
        />
      ) : null}

      {canEdit ? (
        <section className="card card-pad">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest muted">
            Nou equip
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
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
                <p className="mb-2 text-xs font-medium uppercase tracking-wide muted">
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
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          selected
                            ? "border-brand-600 bg-brand-600 text-white shadow-sm dark:border-brand-500 dark:bg-brand-500"
                            : "border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800",
                        ].join(" ")}
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

      <section className="card">
        <div className="card-header">
          <span>Equips ({teams.length})</span>
        </div>
        {teams.length === 0 ? (
          <p className="p-6 text-sm muted">Encara no hi ha equips.</p>
        ) : (
          <ul className="card-divide">
            {teams.map((team) => (
              <li key={team.id} className="space-y-3 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {team.name}
                  </p>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRenameTeam(team)}
                      >
                        Reanomenar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveTeam(team)}
                      >
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
        <section className="card card-pad">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest muted">
            Iniciar competició
          </h2>
          <p className="mb-4 text-sm muted">
            Un cop iniciada, es generaran els partits i no podràs modificar els
            equips. Podràs reiniciar-la si cal.
          </p>
          {event.format === "group_stage_bracket" ? (
            <fieldset className="mb-4">
              <legend className="mb-2 text-xs font-medium uppercase tracking-wide muted">
                Repartiment dels grups
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <RadioOption
                  checked={groupAssignment === "order"}
                  onChange={() => setGroupAssignment("order")}
                  title="Per ordre d'afegit"
                  description="Els primers equips van al grup A, els següents al B, etc."
                />
                <RadioOption
                  checked={groupAssignment === "random"}
                  onChange={() => setGroupAssignment("random")}
                  title="Aleatori"
                  description="Els equips es barregen abans de repartir-se en grups."
                />
              </div>
            </fieldset>
          ) : null}
          {initError ? (
            <div className="mb-3">
              <ErrorMessage>{initError}</ErrorMessage>
            </div>
          ) : null}
          <Button onClick={handleInitCompetition} disabled={initBusy} size="lg">
            {initBusy ? "Iniciant…" : "Iniciar competició"}
          </Button>
        </section>
      ) : null}

      {!readOnly && event.status === "in_progress" ? (
        <section className="card border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Competició en curs
              </h2>
              <p className="mt-0.5 text-sm text-amber-800/90 dark:text-amber-100/80">
                Si cal, pots reiniciar-la per tornar a configurar els equips.
              </p>
              <div className="mt-3">
                <Button variant="danger" size="sm" onClick={handleResetCompetition}>
                  Reiniciar competició
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RadioOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition-colors",
        checked
          ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/30 dark:bg-brand-500/10"
          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
      ].join(" ")}
    >
      <input
        type="radio"
        name="group-assignment"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-brand-600"
      />
      <span>
        <span className="block font-medium text-slate-900 dark:text-white">
          {title}
        </span>
        <span className="block text-xs subtle">{description}</span>
      </span>
    </label>
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
        <p className="text-xs italic subtle">Cap participant assignat.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {team.participantIds.map((pid) => {
            const p = participantById.get(pid);
            return (
              <li key={pid}>
                <Badge tone="brand">
                  {p?.name ?? pid}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => onRemove(pid)}
                      className="ml-1 text-brand-500/70 transition-colors hover:text-rose-600"
                      aria-label="Treure participant"
                    >
                      ×
                    </button>
                  ) : null}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && availableParticipants.length > 0 ? (
        <div className="flex items-center gap-2">
          <Select
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
            className="h-8 py-0 text-xs"
          >
            <option value="">Afegir participant…</option>
            {availableParticipants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            size="sm"
            disabled={!pickerValue}
            onClick={() => {
              if (!pickerValue) return;
              onAdd(pickerValue);
              setPickerValue("");
            }}
          >
            Afegir
          </Button>
        </div>
      ) : null}
    </div>
  );
}
