import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/ui/PageHeader";
import { ErrorMessage } from "@/ui/forms";
import {
  attendanceRepo,
  eventsRepo,
  matchesRepo,
  participantsRepo,
  teamsRepo,
} from "@/data";
import type {
  AttendanceRecord,
  Match,
  OlimpiadaEvent,
  Participant,
  Team,
} from "@/domain/types";
import { formatLabels } from "@/domain/formatLabels";
import { useSeasons } from "@/features/seasons/SeasonContext";
import { useAuth, hasRole } from "@/features/auth/AuthContext";
import { TeamsTab } from "./tabs/TeamsTab";
import { AttendanceTab } from "./tabs/AttendanceTab";
import { ResultsTab } from "./tabs/ResultsTab";

type TabKey = "teams" | "attendance" | "results";

export interface EventData {
  event: OlimpiadaEvent;
  teams: Team[];
  participants: Participant[];
  matches: Match[];
  attendance: AttendanceRecord[];
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { currentSeason } = useSeasons();
  const { appUser } = useAuth();
  const canWrite = hasRole(appUser, ["admin", "superadmin"]);
  const isArchived = currentSeason?.status === "archived";
  const readOnly = !canWrite || isArchived;

  const [data, setData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("teams");

  const seasonId = currentSeason?.id;

  const load = useCallback(async () => {
    if (!seasonId || !eventId) return;
    // Només mostrem el placeholder de "Carregant…" a la càrrega inicial.
    // Als refrescs posteriors mantenim la UI visible per no perdre el scroll ni
    // fer saltar la pantalla cada cop que l'admin desa un resultat.
    setData((prev) => {
      if (prev === null) setLoading(true);
      return prev;
    });
    setError(null);
    try {
      const [event, teams, participants, matches, attendance] = await Promise.all([
        eventsRepo.get(seasonId, eventId),
        teamsRepo.list(seasonId, eventId),
        participantsRepo.list(seasonId),
        matchesRepo.list(seasonId, eventId),
        attendanceRepo.listForEvent(seasonId, eventId),
      ]);
      if (!event) {
        setError("Aquest esdeveniment no existeix.");
        setData(null);
        return;
      }
      setData({ event, teams, participants, matches, attendance });
    } catch (e) {
      console.error(e);
      setError("No s'han pogut carregar les dades de l'esdeveniment.");
    } finally {
      setLoading(false);
    }
  }, [seasonId, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentSeason) {
    return (
      <div>
        <PageHeader title="Esdeveniment" />
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Cap temporada seleccionada.
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Esdeveniment" />
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Carregant…
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Esdeveniment" />
        <ErrorMessage>{error ?? "Esdeveniment no trobat."}</ErrorMessage>
        <Link to="/esdeveniments" className="text-sm text-slate-700 underline">
          ← Tornar a la llista
        </Link>
      </div>
    );
  }

  const { event } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/esdeveniments"
          className="mb-2 inline-block text-xs text-slate-500 hover:text-slate-700"
        >
          ← Esdeveniments
        </Link>
        <PageHeader
          title={event.name ? `${event.name} · ${event.sport}` : event.sport}
          description={`${event.date} · ${formatLabels[event.format]} · ${statusLabel(event.status)}`}
        />
      </div>

      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === "teams"} onClick={() => setTab("teams")}>
          Equips
        </TabButton>
        <TabButton active={tab === "attendance"} onClick={() => setTab("attendance")}>
          Assistència
        </TabButton>
        <TabButton active={tab === "results"} onClick={() => setTab("results")}>
          Resultats
        </TabButton>
      </div>

      {tab === "teams" ? (
        <TeamsTab data={data} readOnly={readOnly} onChanged={load} />
      ) : tab === "attendance" ? (
        <AttendanceTab data={data} readOnly={readOnly} onChanged={load} />
      ) : (
        <ResultsTab data={data} readOnly={readOnly} onChanged={load} />
      )}

      {canWrite && !isArchived && event.status !== "draft" ? (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          L'esdeveniment està {event.status === "in_progress" ? "en curs" : "finalitzat"}.
          {event.status === "finished" ? (
            <>
              {" "}Per editar-lo de nou, hauràs de reobrir-lo des de la tab
              <em> Resultats</em>.
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function statusLabel(s: OlimpiadaEvent["status"]): string {
  switch (s) {
    case "draft":
      return "Esborrany";
    case "in_progress":
      return "En curs";
    case "finished":
      return "Finalitzat";
  }
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

