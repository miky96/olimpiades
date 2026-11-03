import { useMemo, useState, type FormEvent } from "react";
import { Badge, Button, ErrorMessage, Field, Input, Select } from "@/ui/forms";
import { useDialog } from "@/ui/dialog/useDialog";
import {
  competitionRepo,
  matchesRepo,
  pointsRoundsRepo,
  teamsRepo,
  eventsRepo,
} from "@/data";
import type { AttendanceStatus, Participant, Team } from "@/domain/types";
import {
  assignedParticipantIds,
  canAddCompetitorMidway,
  canEditTeamMembers,
  canRemoveCompetitorMidway,
  competition,
  isMarkedAbsent,
} from "@/domain";
import { isIndividualMode } from "@/domain/formatLabels";
import { useSeasons } from "@/features/seasons/useSeasons";
import type { EventData } from "../EventDetailPage";
import { RandomTeamsGenerator } from "./RandomTeamsGenerator";
import { changeTeamMembers, markAttendance } from "./teams/teamMembersActions";

interface Props {
  data: EventData;
  readOnly: boolean;
  onChanged: () => Promise<void> | void;
}

export function TeamsTab({ data, readOnly, onChanged }: Props) {
  const dialog = useDialog();
  const { currentSeason } = useSeasons();
  const { event, teams, participants, attendance, matches } = data;
  const seasonId = currentSeason?.id ?? "";
  const isDraft = event.status === "draft";
  const inProgress = event.status === "in_progress";
  const canEdit = !readOnly && isDraft;
  const canEditMembersOf = (team: Team) =>
    !readOnly && canEditTeamMembers(event, team, matches);
  const canAddCompetitor = !readOnly && canAddCompetitorMidway(event);
  const individual = isIndividualMode(event.format, event.config);
  // En mode individual fem servir "participants" als textos per coherència
  // amb el que veu l'usuari (cada team és en realitat 1 participant).
  const entityLabelPlural = individual ? "participants" : "equips";

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

  const assignedIds = useMemo(
    () => assignedParticipantIds(event, teams, matches),
    [event, teams, matches]
  );

  // Els absents no s'ofereixen: si algú marcat absent acaba venint, cal
  // canviar-li primer l'assistència (p. ex. a "Arriba tard").
  const availableParticipants = participants
    .filter(
      (p) =>
        p.active && !assignedIds.has(p.id) && !isMarkedAbsent(p.id, attendance)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const attendanceOf = (participantId: string) =>
    attendance.find((a) => a.participantId === participantId);

  /**
   * Amb la competició en curs, en afegir algú pregunta si cal marcar-lo com
   * a "Arriba tard". Retorna false si l'usuari cancel·la.
   */
  async function confirmLateArrival(participantId: string): Promise<boolean> {
    if (!inProgress) return true;
    const rec = attendanceOf(participantId);
    if (rec?.status === "late") return true;
    const name = participantById.get(participantId)?.name ?? "";
    const choice = await dialog.choose({
      title: `Afegir ${name}`,
      options: [
        {
          value: "late",
          label: "Afegir i marcar com a 'Arriba tard'",
          description: "S'aplica la penalització per defecte de retard.",
          variant: "primary",
        },
        {
          value: "keep",
          label: "Afegir sense canviar l'assistència",
        },
      ],
    });
    if (!choice) return false;
    if (choice === "late") {
      await markAttendance({
        seasonId,
        eventId: event.id,
        participantId,
        status: "late",
        existing: rec,
      });
    }
    return true;
  }

  /**
   * Amb la competició en curs, en treure algú pregunta si cal marcar-lo com
   * a absent. Retorna false si l'usuari cancel·la.
   */
  async function confirmRemoval(participantId: string): Promise<boolean> {
    if (!inProgress) return true;
    if (isMarkedAbsent(participantId, attendance)) return true;
    const name = participantById.get(participantId)?.name ?? "";
    const choice = await dialog.choose<AttendanceStatus | "keep">({
      title: `Treure ${name}`,
      message: "Vols marcar-lo també com a absent?",
      options: [
        { value: "absent_notified", label: "Treure i marcar 'Absent (avisat)'" },
        {
          value: "absent_unnotified",
          label: "Treure i marcar 'Absent (sense avisar)'",
        },
        { value: "keep", label: "Només treure (no tocar l'assistència)" },
      ],
    });
    if (!choice) return false;
    if (choice !== "keep") {
      await markAttendance({
        seasonId,
        eventId: event.id,
        participantId,
        status: choice,
        existing: attendanceOf(participantId),
      });
    }
    return true;
  }

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
    const next = await dialog.prompt({
      title: "Reanomenar equip",
      label: "Nou nom de l'equip",
      defaultValue: team.name,
      required: true,
    });
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === team.name) return;
    try {
      await teamsRepo.update(seasonId, event.id, team.id, { name: trimmed });
      await onChanged();
    } catch (err) {
      console.error(err);
      await dialog.alert({
        title: "No s'ha pogut canviar el nom",
        tone: "danger",
      });
    }
  }

  async function handleRemoveTeam(team: Team) {
    if (!canEdit) return;
    const ok = await dialog.confirm({
      title: "Eliminar equip",
      message: `Eliminar l'equip "${team.name}"?`,
      confirmLabel: "Eliminar",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await teamsRepo.remove(seasonId, event.id, team.id);
      await onChanged();
    } catch (err) {
      console.error(err);
      await dialog.alert({
        title: "No s'ha pogut eliminar l'equip",
        tone: "danger",
      });
    }
  }

  async function handleAddMember(team: Team, participantId: string) {
    if (!canEditMembersOf(team)) return;
    if (team.participantIds.includes(participantId)) return;
    try {
      if (!(await confirmLateArrival(participantId))) return;
      await changeTeamMembers({
        seasonId,
        event,
        team,
        nextParticipantIds: [...team.participantIds, participantId],
        matches,
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      await dialog.alert({
        title: "No s'ha pogut afegir el participant",
        tone: "danger",
      });
    }
  }

  async function handleRemoveMember(team: Team, participantId: string) {
    if (!canEditMembersOf(team)) return;
    try {
      if (!(await confirmRemoval(participantId))) return;
      await changeTeamMembers({
        seasonId,
        event,
        team,
        nextParticipantIds: team.participantIds.filter(
          (id) => id !== participantId
        ),
        matches,
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      await dialog.alert({
        title: "No s'ha pogut treure el participant",
        tone: "danger",
      });
    }
  }

  /** Formats individuals per puntuació: afegir un competidor a mitja prova. */
  async function handleAddCompetitor(participantId: string) {
    if (!canAddCompetitor) return;
    const p = participantById.get(participantId);
    if (!p) return;
    try {
      if (!(await confirmLateArrival(participantId))) return;
      await teamsRepo.create(seasonId, event.id, {
        name: p.name,
        participantIds: [p.id],
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      await dialog.alert({
        title: "No s'ha pogut afegir el participant",
        tone: "danger",
      });
    }
  }

  /** Formats individuals per puntuació: treure un competidor a mitja prova. */
  async function handleRemoveCompetitor(team: Team) {
    if (readOnly || !canRemoveCompetitorMidway(event, team, matches)) return;
    try {
      const pid = team.participantIds[0];
      if (pid) {
        if (!(await confirmRemoval(pid))) return;
      } else {
        const ok = await dialog.confirm({
          title: "Treure participant",
          message: `Treure "${team.name}" de la competició?`,
          confirmLabel: "Treure",
          tone: "danger",
        });
        if (!ok) return;
      }
      await teamsRepo.remove(seasonId, event.id, team.id);
      await onChanged();
    } catch (err) {
      console.error(err);
      await dialog.alert({
        title: "No s'ha pogut treure el participant",
        tone: "danger",
      });
    }
  }

  async function handleInitCompetition() {
    if (!canEdit) return;
    setInitError(null);
    const eligibleTeams = teams.filter((t) => t.participantIds.length > 0);
    if (eligibleTeams.length < 2) {
      setInitError(
        individual
          ? "Es necessiten com a mínim 2 participants."
          : "Es necessiten com a mínim 2 equips amb participants."
      );
      return;
    }
    if (event.format === "single_match" && eligibleTeams.length !== 2) {
      setInitError('El format "Partit únic" requereix exactament 2 equips.');
      return;
    }
    if (event.format === "rotating_singles" && eligibleTeams.length !== 2) {
      setInitError(
        'El format "Partits rotatius" requereix exactament 2 equips inicials. Després podràs regenerar-los entre rondes.'
      );
      return;
    }
    if (event.format === "group_stage_bracket" && eligibleTeams.length < 4) {
      setInitError(
        individual
          ? 'El format "Lligueta + bracket" en mode individual necessita almenys 4 participants.'
          : 'El format "Lligueta + bracket" necessita almenys 4 equips.'
      );
      return;
    }
    if (event.format === "league_only" && eligibleTeams.length < 2) {
      setInitError(
        individual
          ? 'El format "Només lligueta" en mode individual necessita almenys 2 participants.'
          : 'El format "Només lligueta" necessita almenys 2 equips.'
      );
      return;
    }
    if (event.format === "score_ranking" && eligibleTeams.length < 2) {
      setInitError(
        individual
          ? 'El format "Prova única per puntuació" necessita almenys 2 participants.'
          : 'El format "Prova única per puntuació" necessita almenys 2 equips.'
      );
      return;
    }
    if (event.format === "points_league_bracket" && eligibleTeams.length < 2) {
      setInitError(
        'El format "Lligueta de punts" necessita almenys 2 participants.'
      );
      return;
    }
    const ok = await dialog.confirm({
      title: "Iniciar competició",
      message: individual
        ? "Un cop iniciada, els participants queden bloquejats. Vols continuar?"
        : "Un cop iniciada, els equips queden bloquejats. Vols continuar?",
      confirmLabel: "Iniciar",
    });
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
      const teamGroupAssignments =
        event.format === "group_stage_bracket" && result.groups
          ? result.groups.flatMap((g) =>
              g.teamIds.map((teamId) => ({ teamId, groupId: g.id }))
            )
          : undefined;
      // Atòmic: groupIds + matches + status passen en un sol writeBatch.
      // Si caigués al mig, no es persistiria cap escriptura parcial i
      // l'usuari pot reintentar sense risc de duplicar matches.
      await competitionRepo.startCompetition({
        seasonId,
        eventId: event.id,
        teamGroupAssignments,
        matches: result.matches,
      });
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
    const ok = await dialog.confirm({
      title: "Reiniciar competició",
      message: individual
        ? "S'eliminaran tots els partits i podràs canviar els participants. Vols continuar?"
        : "S'eliminaran tots els partits i podràs canviar els equips. Vols continuar?",
      confirmLabel: "Reiniciar",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await matchesRepo.clearAll(seasonId, event.id);
      // Per `points_league_bracket` també esborrem les rondes de puntuació
      // per deixar l'esdeveniment realment com a "draft" net. Si es vol
      // conservar les rondes i només refer el bracket, l'admin pot
      // fer-ho des de la vista de resultats (acció més fina).
      if (
        event.format === "points_league_bracket" ||
        event.format === "score_ranking"
      ) {
        await pointsRoundsRepo.clearAll(seasonId, event.id);
      }
      await eventsRepo.update(seasonId, event.id, { status: "draft" });
      await onChanged();
    } catch (err) {
      console.error(err);
      await dialog.alert({
        title: "No s'ha pogut reiniciar la competició",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-6">
      {canEdit && teams.length === 0 ? (
        <RandomTeamsGenerator
          seasonId={seasonId}
          eventId={event.id}
          format={event.format}
          config={event.config}
          participants={participants}
          attendance={data.attendance}
          onGenerated={onChanged}
        />
      ) : null}

      {canEdit && !individual ? (
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

      {canAddCompetitor ? (
        <AddCompetitorCard
          availableParticipants={availableParticipants.filter(
            (p) => !teams.some((t) => t.participantIds.includes(p.id))
          )}
          onAdd={handleAddCompetitor}
        />
      ) : null}

      <section className="card">
        <div className="card-header">
          <span>
            {individual ? "Participants" : "Equips"} ({teams.length})
          </span>
        </div>
        {inProgress && !readOnly && !individual ? (
          <p className="border-b border-slate-200/70 px-4 py-2 text-xs muted dark:border-slate-800/70 sm:px-6">
            {event.format === "rotating_singles"
              ? "Pots afegir qui arriba tard o treure qui marxa dels equips del partit en curs. Els partits ja jugats no canvien."
              : "Pots afegir qui arriba tard o treure qui falta. En finalitzar, cada membre rep els punts de la posició del seu equip."}
          </p>
        ) : null}
        {teams.length === 0 ? (
          <p className="p-6 text-sm muted">
            {individual
              ? "Encara no hi ha participants."
              : "Encara no hi ha equips."}
          </p>
        ) : (
          <ul className="card-divide">
            {teams.map((team) => (
              <li key={team.id} className="space-y-3 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {team.name}
                  </p>
                  {!canEdit &&
                  !readOnly &&
                  canRemoveCompetitorMidway(event, team, matches) ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemoveCompetitor(team)}
                    >
                      Treure
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      {individual ? null : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRenameTeam(team)}
                        >
                          Reanomenar
                        </Button>
                      )}
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
                {individual ? null : (
                  <TeamMembers
                    team={team}
                    participantById={participantById}
                    availableParticipants={availableParticipants}
                    canEdit={canEditMembersOf(team)}
                    onAdd={(pid) => handleAddMember(team, pid)}
                    onRemove={(pid) => handleRemoveMember(team, pid)}
                  />
                )}
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
            Un cop iniciada, es generaran els partits i no podràs modificar els{" "}
            {entityLabelPlural}. Podràs reiniciar-la si cal.
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
                {individual && !canAddCompetitor
                  ? "En aquest format no es poden afegir ni treure participants a mitja competició; si cal, reinicia-la per tornar a configurar-los."
                  : `Si cal, pots reiniciar-la per tornar a configurar els ${entityLabelPlural}.`}
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

function AddCompetitorCard({
  availableParticipants,
  onAdd,
}: {
  availableParticipants: Participant[];
  onAdd: (participantId: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <section className="card card-pad">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest muted">
        Afegir participant
      </h2>
      <p className="mb-3 text-sm muted">
        Per a qui arriba tard: s'afegeix a la classificació sense puntuació.
      </p>
      {availableParticipants.length === 0 ? (
        <p className="text-xs italic subtle">
          No hi ha cap participant disponible (els absents no surten; canvia'ls
          l'assistència si han arribat).
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <Select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 py-0 text-xs"
          >
            <option value="">Tria un participant…</option>
            {availableParticipants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            size="sm"
            disabled={!value}
            onClick={() => {
              if (!value) return;
              onAdd(value);
              setValue("");
            }}
          >
            Afegir
          </Button>
        </div>
      )}
    </section>
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
