import { useEffect, useMemo, useState } from "react";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { useDialog } from "@/ui/dialog/useDialog";
import { eventsRepo, teamsRepo } from "@/data";
import {
  generateRandomTeams,
  planTeamSizes,
} from "@/domain/competition/randomTeams";
import { selectPresentParticipants } from "@/domain/attendance";
import { supportsIndividualMode } from "@/domain/formatLabels";
import type {
  AttendanceRecord,
  EventFormat,
  EventFormatConfig,
  Participant,
} from "@/domain/types";

interface Props {
  seasonId: string;
  eventId: string;
  format: EventFormat;
  config: EventFormatConfig;
  participants: Participant[];
  attendance: AttendanceRecord[];
  onGenerated: () => Promise<void> | void;
}

/**
 * Formats que requereixen exactament 2 equips. En aquests, el formulari
 * fixa el nombre d'equips a 2 i la mida d'equip a la meitat (arrodonida
 * amunt) dels participants presents.
 */
const TWO_TEAM_FORMATS: EventFormat[] = ["single_match", "rotating_singles"];

/**
 * Converteix l'string del control numèric a number per a la lògica de
 * validació i preview. Retorna NaN si està buit o malformat (perquè els
 * checks de "ha de ser enter" facin la feina sense que un input buit es
 * converteixi silenciosament a 0).
 */
function parseIntInput(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return Number.NaN;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function RandomTeamsGenerator({
  seasonId,
  eventId,
  format,
  config,
  participants,
  attendance,
  onGenerated,
}: Props) {
  const dialog = useDialog();
  const present = useMemo(
    () => selectPresentParticipants(participants, attendance),
    [participants, attendance]
  );
  const total = present.length;

  const canBeIndividual = supportsIndividualMode(format);
  const [individualMode, setIndividualMode] = useState<boolean>(
    Boolean(config?.individualMode) && canBeIndividual
  );

  const lockToTwoTeams = TWO_TEAM_FORMATS.includes(format);

  const defaultTeamCount = lockToTwoTeams
    ? 2
    : total >= 4
    ? 4
    : Math.max(2, total);
  const defaultMembersPerTeam = Math.max(
    1,
    Math.ceil(total / Math.max(2, defaultTeamCount))
  );

  // Mantenim l'estat com a string per permetre que l'usuari deixi el camp
  // buit temporalment (mentre escriu) sense que es reompli amb un 0.
  const [teamCountText, setTeamCountText] = useState<string>(
    String(defaultTeamCount)
  );
  const [membersPerTeamText, setMembersPerTeamText] = useState<string>(
    String(defaultMembersPerTeam)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamCount = parseIntInput(teamCountText);
  const membersPerTeam = parseIntInput(membersPerTeamText);

  // Quan el format obliga a 2 equips, mantenim els camps sincronitzats
  // automàticament amb el total de presents (l'usuari no pot tocar-ho,
  // però els valors han d'actualitzar-se si canvia l'assistència).
  useEffect(() => {
    if (!lockToTwoTeams) return;
    setTeamCountText("2");
    setMembersPerTeamText(String(Math.max(1, Math.ceil(total / 2))));
  }, [lockToTwoTeams, total]);

  const previewSizes = useMemo(() => {
    if (
      total < 2 ||
      !Number.isInteger(teamCount) ||
      teamCount < 2 ||
      !Number.isInteger(membersPerTeam) ||
      membersPerTeam < 1 ||
      total < teamCount
    ) {
      return null;
    }
    try {
      return planTeamSizes(total, teamCount, membersPerTeam);
    } catch {
      return null;
    }
  }, [total, teamCount, membersPerTeam]);

  if (total < 2) {
    return (
      <section className="card card-pad">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest muted">
          Generador d'equips aleatori
        </h2>
        <p className="text-sm muted">
          Calen com a mínim 2 participants amb estat <em>present</em> per generar
          equips. Marca l'assistència a la pestanya corresponent.
        </p>
      </section>
    );
  }

  async function persistIndividualModeFlag(value: boolean) {
    // Persistim el flag al config de l'event per fer-lo "sticky": la resta
    // de la UI (TeamsTab, ResultsTab, llistat d'esdeveniments) ja podrà
    // adaptar-se sense haver de mantenir l'estat només a memòria.
    if (Boolean(config?.individualMode) === value) return;
    const nextConfig: EventFormatConfig = { ...config, individualMode: value };
    await eventsRepo.update(seasonId, eventId, { config: nextConfig });
  }

  async function handleGenerate() {
    setError(null);

    if (individualMode) {
      if (total < 2) {
        setError("Calen com a mínim 2 participants presents.");
        return;
      }
      const ok = await dialog.confirm({
        title: "Generar entrades individuals",
        message: `Es crearà una entrada individual per cadascun dels ${total} participants presents. Vols continuar?`,
        confirmLabel: "Generar",
      });
      if (!ok) return;
      setBusy(true);
      try {
        await persistIndividualModeFlag(true);
        for (const p of present) {
          await teamsRepo.create(seasonId, eventId, {
            name: p.name,
            participantIds: [p.id],
          });
        }
        await onGenerated();
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "No s'han pogut generar els participants."
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!Number.isInteger(teamCount) || teamCount < 2) {
      setError("Cal indicar com a mínim 2 equips.");
      return;
    }
    if (!Number.isInteger(membersPerTeam) || membersPerTeam < 1) {
      setError("Cada equip ha de tenir com a mínim 1 membre.");
      return;
    }
    if (total < teamCount) {
      setError(
        `Hi ha ${total} presents però es demanen ${teamCount} equips.`
      );
      return;
    }
    const ok = await dialog.confirm({
      title: "Generar equips aleatoris",
      message: `Es crearan ${teamCount} equips amb els ${total} participants presents. Vols continuar?`,
      confirmLabel: "Generar",
    });
    if (!ok) return;
    setBusy(true);
    try {
      // Si l'esdeveniment tenia el flag d'individual activat però ara
      // l'admin escull mode equips, el desactivem perquè la UI no quedi
      // en un estat incoherent.
      await persistIndividualModeFlag(false);
      const plan = generateRandomTeams({
        participantIds: present.map((p) => p.id),
        teamCount,
        membersPerTeam,
      });
      for (const t of plan) {
        await teamsRepo.create(seasonId, eventId, {
          name: t.name,
          participantIds: t.participantIds,
        });
      }
      await onGenerated();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "No s'han pogut generar els equips."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest muted">
        {individualMode ? "Generador d'individuals" : "Generador d'equips aleatori"}
      </h2>
      <p className="mb-4 text-sm muted">
        Es repartiran els <strong>{total}</strong> participant
        {total === 1 ? "" : "s"} marcat{total === 1 ? "" : "s"} com a{" "}
        <em>present</em> a l'esdeveniment.
        {individualMode ? (
          <>
            {" "}En mode individual, cada participant competeix sol amb el seu
            propi nom.
          </>
        ) : lockToTwoTeams ? (
          <>
            {" "}Aquest format usa sempre <strong>2 equips</strong>; els
            participants es reparteixen automàticament a parts iguals.
          </>
        ) : null}
      </p>

      {canBeIndividual ? (
        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide muted">
            Tipus de competidor
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <ModeOption
              checked={!individualMode}
              onChange={() => setIndividualMode(false)}
              title="Equips"
              description="Repartim els participants en N equips."
            />
            <ModeOption
              checked={individualMode}
              onChange={() => setIndividualMode(true)}
              title="Individual"
              description="Cada participant és un competidor amb el seu nom."
            />
          </div>
        </fieldset>
      ) : null}

      {individualMode ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre d'equips">
              <Input
                type="number"
                inputMode="numeric"
                min={2}
                step={1}
                value={teamCountText}
                onChange={(e) => setTeamCountText(e.target.value)}
                disabled={lockToTwoTeams}
                aria-readonly={lockToTwoTeams}
              />
            </Field>
            <Field label="Membres per equip (objectiu)">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={membersPerTeamText}
                onChange={(e) => setMembersPerTeamText(e.target.value)}
                disabled={lockToTwoTeams}
                aria-readonly={lockToTwoTeams}
              />
            </Field>
          </div>
          {previewSizes ? (
            <p className="mt-3 text-xs muted">
              Mides resultants: <strong>{previewSizes.join(" · ")}</strong>
              {previewSizes.some((s) => s !== membersPerTeam) ? (
                <>
                  {" "}
                  (alguns equips tindran {Math.min(...previewSizes)}–
                  {Math.max(...previewSizes)} membres per quadrar amb els {total}{" "}
                  presents)
                </>
              ) : null}
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <div className="mt-3">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button onClick={handleGenerate} disabled={busy}>
          {busy
            ? "Generant…"
            : individualMode
            ? "Generar individuals"
            : "Generar equips"}
        </Button>
      </div>
    </section>
  );
}

function ModeOption({
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
        name="competitor-mode"
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
