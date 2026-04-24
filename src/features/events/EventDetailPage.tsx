import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/ui/PageHeader";
import { Badge, ErrorMessage } from "@/ui/forms";
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
import { useSeasons } from "@/features/seasons/useSeasons";
import { useAuth, hasRole } from "@/features/auth/useAuth";
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
      <div className="space-y-6">
        <PageHeader title="Esdeveniment" />
        <div className="card card-pad text-sm muted">
          Cap temporada seleccionada.
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Esdeveniment" />
        <p className="card card-pad text-sm muted">Carregant…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Esdeveniment" />
        <ErrorMessage>{error ?? "Esdeveniment no trobat."}</ErrorMessage>
        <Link to="/esdeveniments" className="link text-sm">
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
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Esdeveniments
        </Link>
        <PageHeader
          eyebrow={event.sport}
          title={event.name || event.sport}
          description={`${event.date} · ${formatLabels[event.format]}`}
          action={<EventStatusBadge status={event.status} />}
        />
      </div>

      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      <div
        role="tablist"
        className="flex gap-1 rounded-full bg-slate-100/80 p-1 text-sm dark:bg-slate-800/60"
      >
        <TabButton active={tab === "teams"} onClick={() => setTab("teams")}>
          Equips
        </TabButton>
        <TabButton
          active={tab === "attendance"}
          onClick={() => setTab("attendance")}
        >
          Assistència
        </TabButton>
        <TabButton active={tab === "results"} onClick={() => setTab("results")}>
          Resultats
        </TabButton>
      </div>

      <div className="animate-fade-in">
        {tab === "teams" ? (
          <TeamsTab data={data} readOnly={readOnly} onChanged={load} />
        ) : tab === "attendance" ? (
          <AttendanceTab data={data} readOnly={readOnly} onChanged={load} />
        ) : (
          <ResultsTab data={data} readOnly={readOnly} onChanged={load} />
        )}
      </div>

      {canWrite && !isArchived && event.status !== "draft" ? (
        <section className="card flex items-start gap-3 p-4 text-xs muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <div>
            L'esdeveniment està{" "}
            {event.status === "in_progress" ? "en curs" : "finalitzat"}.
            {event.status === "finished" ? (
              <>
                {" "}Per editar-lo de nou, hauràs de reobrir-lo des de la pestanya
                <em> Resultats</em>.
              </>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EventStatusBadge({ status }: { status: OlimpiadaEvent["status"] }) {
  if (status === "draft") return <Badge tone="slate">Esborrany</Badge>;
  if (status === "in_progress") return <Badge tone="amber">En curs</Badge>;
  return <Badge tone="emerald">Finalitzat</Badge>;
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-all",
        active
          ? "bg-white text-slate-900 shadow-card dark:bg-slate-900 dark:text-white"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
