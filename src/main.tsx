import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { SeasonProvider } from "@/features/seasons/SeasonContext";
import { DialogProvider } from "@/ui/dialog/DialogProvider";
import { router } from "./routes/router";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DialogProvider>
      <AuthProvider>
        <SeasonProvider>
          <RouterProvider router={router} />
        </SeasonProvider>
      </AuthProvider>
    </DialogProvider>
  </React.StrictMode>
);
