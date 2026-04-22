import { jsx as _jsx } from "react/jsx-runtime";
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
        element: _jsx(AppLayout, {}),
        children: [
            { index: true, element: _jsx(Navigate, { to: "/classificacio", replace: true }) },
            // Rutes públiques
            { path: "classificacio", element: _jsx(StandingsPage, {}) },
            { path: "login", element: _jsx(LoginPage, {}) },
            // Rutes per a admins i superadmins
            {
                element: _jsx(ProtectedRoute, {}),
                children: [
                    { path: "esdeveniments", element: _jsx(EventsPage, {}) },
                    { path: "esdeveniments/:eventId", element: _jsx(EventDetailPage, {}) },
                    { path: "participants", element: _jsx(ParticipantsPage, {}) },
                ],
            },
            // Rutes exclusives de superadmin
            {
                element: _jsx(ProtectedRoute, { roles: ["superadmin"] }),
                children: [
                    { path: "admin/usuaris", element: _jsx(AdminUsersPage, {}) },
                    { path: "admin/temporades", element: _jsx(SeasonsPage, {}) },
                ],
            },
        ],
    },
]);
