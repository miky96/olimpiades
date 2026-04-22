import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { SeasonProvider } from "@/features/seasons/SeasonContext";
import { router } from "./routes/router";
import "./index.css";
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(AuthProvider, { children: _jsx(SeasonProvider, { children: _jsx(RouterProvider, { router: router }) }) }) }));
