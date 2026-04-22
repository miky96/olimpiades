import { describe, expect, it } from "vitest";
import { hasRole } from "./AuthContext";
const admin = { uid: "1", email: "a@a", role: "admin", status: "active" };
const superadmin = { uid: "2", email: "s@s", role: "superadmin", status: "active" };
const blocked = { uid: "3", email: "b@b", role: "admin", status: "blocked" };
describe("hasRole", () => {
    it("accepta si el rol coincideix i l'usuari és actiu", () => {
        expect(hasRole(admin, ["admin"])).toBe(true);
        expect(hasRole(admin, ["admin", "superadmin"])).toBe(true);
    });
    it("rebutja si l'usuari està bloquejat", () => {
        expect(hasRole(blocked, ["admin"])).toBe(false);
    });
    it("rebutja si el rol no coincideix", () => {
        expect(hasRole(admin, ["superadmin"])).toBe(false);
    });
    it("superadmin compleix explícitament superadmin", () => {
        expect(hasRole(superadmin, ["superadmin"])).toBe(true);
    });
    it("rebutja si no hi ha usuari", () => {
        expect(hasRole(null, ["admin"])).toBe(false);
    });
});
