import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/ui/AppLayout";
import { StandingsPage } from "@/features/standings/StandingsPage";
import { EventsPage } from "@/features/events/EventsPage";
import { EventDetailPage } from "@/features/events/EventDetailPage";
import { ParticipantsPage } from "@/features/participants/ParticipantsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { AdminUsersPage } from "@/features/admin/AdminUsersPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/classificacio" replace /> },
      { path: "classificacio", element: <StandingsPage /> },
      { path: "esdeveniments", element: <EventsPage /> },
      { path: "esdeveniments/:eventId", element: <EventDetailPage /> },
      { path: "participants", element: <ParticipantsPage /> },
      { path: "admin/usuaris", element: <AdminUsersPage /> },
      { path: "login", element: <LoginPage /> },
    ],
  },
]);
