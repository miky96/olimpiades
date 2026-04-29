/**
 * Postinstall hook: assegura que `functions/` també té les seves dependències.
 *
 * Es dispara només quan `npm install` s'executa des de l'arrel del projecte
 * (`INIT_CWD === projectRoot`), per evitar bucles si algú importa aquest
 * paquet com a `file:` dependència (cosa que `functions/` ja fa).
 *
 * Si la primera passada falla (per exemple, lockfile obsolet del paquet
 * functions/), reintenta una vegada després d'eliminar el package-lock.json.
 *
 * Comparació de paths cross-platform: Windows pot variar el casing de la
 * lletra de disc entre `__dirname` i `INIT_CWD`. Fem la comparació
 * insensible a majúscules en aquesta plataforma.
 */
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const initCwdRaw = process.env.INIT_CWD || process.cwd();
const initCwd = path.resolve(initCwdRaw);

const isWin = process.platform === "win32";

function samePath(a, b) {
  if (a === b) return true;
  if (isWin) return a.toLowerCase() === b.toLowerCase();
  return false;
}

if (!samePath(initCwd, projectRoot)) {
  process.exit(0);
}

const functionsDir = path.join(projectRoot, "functions");
if (!fs.existsSync(path.join(functionsDir, "package.json"))) {
  process.exit(0);
}

const tscBin = path.join(
  functionsDir,
  "node_modules",
  ".bin",
  isWin ? "tsc.cmd" : "tsc"
);
if (fs.existsSync(tscBin)) {
  process.exit(0);
}

function runInstall() {
  // shell: true assegura que a Windows es resolgui `npm` via PATH (npm.cmd).
  return spawnSync("npm install --no-audit --no-fund --no-progress", {
    cwd: functionsDir,
    stdio: "inherit",
    shell: true,
  });
}

console.log(`[postinstall] cwd=${functionsDir}`);
console.log("[postinstall] Instal·lant dependències de functions/...");
let result = runInstall();

if (result.error) {
  console.error("[postinstall] Error executant npm:", result.error.message);
}

if (result.status !== 0) {
  const lockfile = path.join(functionsDir, "package-lock.json");
  if (fs.existsSync(lockfile)) {
    console.warn(
      `[postinstall] npm install ha sortit amb codi ${result.status}. Eliminant package-lock.json i reintentant...`
    );
    try {
      fs.unlinkSync(lockfile);
    } catch (err) {
      console.error(
        "[postinstall] No s'ha pogut eliminar el lockfile:",
        err.message
      );
      process.exit(result.status ?? 1);
    }
    result = runInstall();
    if (result.error) {
      console.error(
        "[postinstall] Error executant npm (reintent):",
        result.error.message
      );
    }
  } else {
    console.warn(
      `[postinstall] npm install ha sortit amb codi ${result.status} i no hi ha lockfile per eliminar.`
    );
  }
}

if (result.status !== 0) {
  console.error(
    "[postinstall] No s'ha pogut instal·lar functions/. Executa manualment: npm install --prefix functions"
  );
}
process.exit(result.status ?? 0);
