import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function PageHeader({ title, description, action }) {
    return (_jsxs("div", { className: "mb-6 flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-slate-900", children: title }), description ? (_jsx("p", { className: "mt-1 text-sm text-slate-600", children: description })) : null] }), action] }));
}
