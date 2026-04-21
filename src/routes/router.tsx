import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/ui/AppLayout";
import { StandingsPage } from "@/features/standings/StandingsPage";
import { EventsPage } from "@/features/events/EventsPage";
import { EventDetailPage } from "@/features/events/EventDetailPage";
import { ParticipantsPage } from "@/features/participants/ParticipantsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { AdminUsersPage } from "@/features/admin/AdminUsersPage";
import { SeasonsPage } from "@/features/seasons/SeasonsPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/classificacio" replace /> },
      // Rutes públiques
      { path: "classificacio", element: <StandingsPage /> },
      { path: "login", element: <LoginPage /> },
      // Rutes per a admins i superadmins
      {
        element: <ProtectedRoute />,
        children: [
          { path: "esdeveniments", element: <EventsPage /> },
          { path: "esdeveniments/:eventId", element: <EventDetailPage /> },
          { path: "participants", element: <ParticipantsPage /> },
        ],
      },
      // Rutes exclusives de superadmin
      {
        element: <ProtectedRoute roles={["superadmin"]} />,
        children: [
          { path: "admin/usuaris", element: <AdminUsersPage /> },
          { path: "admin/temporades", element: <SeasonsPage /> },
        ],
      },
    ],
  },
]);
