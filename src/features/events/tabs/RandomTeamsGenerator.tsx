import { useMemo, useState } from "react";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { teamsRepo } from "@/data";
import {
  generateRandomTeams,
  planTeamSizes,
} from "@/domain/competition/randomTeams";
import { selectPresentParticipants } from "@/domain/attendance";
import type { AttendanceRecord, Participant } from "@/domain/types";

interface Props {
  seasonId: string;
  eventId: string;
  participants: Participant[];
  attendance: AttendanceRecord[];
  onGenerated: () => Promise<void> | void;
}

export function RandomTeamsGenerator({
  seasonId,
  eventId,
  participants,
  attendance,
  onGenerated,
}: Props) {
  const present = useMemo(
    () => selectPresentParticipants(participants, attendance),
    [participants, attendance]
  );
  const total = present.length;

  const defaultTeamCount = total >= 4 ? 4 : Math.max(2, total);
  const defaultMembersPerTeam = Math.max(
    1,
    Math.ceil(total / Math.max(2, defaultTeamCount))
  );

  const [teamCount, setTeamCount] = useState<number>(defaultTeamCount);
  const [membersPerTeam, setMembersPerTeam] =
    useState<number>(defaultMembersPerTeam);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleGenerate() {
    setError(null);
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
    const ok = window.confirm(
      `Generar ${teamCount} equips aleatoris amb ${total} participants presents?`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const plan = generateRandomTeams({
        participantIds: present.map((p) => p.id),
        teamCount,
        membersPerTeam,
      });
      for (const t of plan) {
        // eslint-disable-next-line no-await-in-loop
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
        Generador d'equips aleatori
      </h2>
      <p className="mb-4 text-sm muted">
        Es repartiran els <strong>{total}</strong> participant
        {total === 1 ? "" : "s"} marcat{total === 1 ? "" : "s"} com a{" "}
        <em>present</em> a l'esdeveniment.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre d'equips">
          <Input
            type="number"
            min={2}
            step={1}
            value={teamCount}
            onChange={(e) => setTeamCount(Number(e.target.value))}
          />
        </Field>
        <Field label="Membres per equip (objectiu)">
          <Input
            type="number"
            min={1}
            step={1}
            value={membersPerTeam}
            onChange={(e) => setMembersPerTeam(Number(e.target.value))}
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
      {error ? (
        <div className="mt-3">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button onClick={handleGenerate} disabled={busy}>
          {busy ? "Generant…" : "Generar equips"}
        </Button>
      </div>
    </section>
  );
}
