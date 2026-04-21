# Olimpíades

Web app per gestionar les **Olimpíades**: un esdeveniment esportiu bisetmanal amb diferents esports, equips, assistència, resultats i classificació general per temporades.

Substitueix el flux manual actual (WhatsApp + Excel) per una eina centralitzada, simple i responsive (mòbil, tablet i desktop).

---

## Què fa l'aplicació

A alt nivell, l'MVP permet:

- Donar d'alta i editar **participants**.
- Crear **esdeveniments** (un esport per dia) dins d'una **temporada**.
- Registrar **assistència** per participant (amb penalitzacions per no avisar i bonus per assistir).
- Crear **equips** per a cada esdeveniment i assignar-hi participants.
- Suportar formats de competició (individual, lligueta en grups de 3–4, eliminatòries amb byes).
- Introduir la **posició final** i calcular **punts automàticament** (5 / 3 / 1 per les 3 primeres posicions; bonus d'assistència +5; penalitzacions configurables, p. ex. −3).
- Mostrar la **classificació general** acumulada de la temporada i l'historial d'esdeveniments.

### Rols

- **Superadmin**: gestiona admins (alta, baixa, bloqueig temporal), obre i tanca temporades.
- **Admin**: pot crear esdeveniments, equips, registrar resultats i introduir puntuacions.
- **Participant** (futur, fora de l'MVP estricte): consulta de classificació i historial.

Per a més detall de producte i regles de negoci:

- [`docs/visio-producte.md`](docs/visio-producte.md)
- [`docs/regles-negoci.md`](docs/regles-negoci.md)
- [`docs/dubtes-oberts.md`](docs/dubtes-oberts.md)
- [`docs/decisions.md`](docs/decisions.md)

---

## Stack tècnic

Prioritzem una solució simple, mantenible i de cost proper a zero en MVP sobre Google Cloud / Firebase.

- **Frontend**: React 18 + TypeScript + Vite
- **Estils**: Tailwind CSS
- **Routing**: React Router
- **Backend / dades**: Firebase (Auth + Firestore)
- **Hosting**: Firebase Hosting
- **Tests**: Vitest
- **Linting / Types**: ESLint + TypeScript (`tsc --noEmit`)

> Nota: de moment no hi ha backend propi. La lògica d'accés a dades viu al client amb **Security Rules** de Firestore. Si en algun cas convé, s'afegirà una capa servidor (per exemple Cloud Functions) de manera aïllada.

---

## Requisits

- **Node.js** ≥ 20 (mirar `.nvmrc`)
- **npm** (el que ve amb Node 20)
- **Firebase CLI** (opcional per a emuladors i deploy): `npm i -g firebase-tools`

---

## Posada en marxa local

```bash
# 1. Instal·la dependències
npm install

# 2. Copia les variables d'entorn i omple-les
cp .env.example .env.local

# 3. Arrenca el servidor de desenvolupament
npm run dev
```

### Scripts disponibles

| Script | Què fa |
|---|---|
| `npm run dev` | Arrenca Vite en mode desenvolupament. |
| `npm run build` | Compila TypeScript i genera el build de producció. |
| `npm run preview` | Serveix el build generat localment. |
| `npm run test` | Executa els tests amb Vitest (un sol run). |
| `npm run test:watch` | Executa els tests en mode watch. |
| `npm run lint` | Passa ESLint a tot el projecte. |
| `npm run typecheck` | Comprova els tipus sense emetre JS. |
| `npm run emulators` | Arrenca els emuladors de Firebase. |
| `npm run deploy:hosting` | Fa build i desplega a Firebase Hosting. |
| `npm run deploy:rules` | Desplega regles i índexs de Firestore. |

---

## Estructura del repositori

```
.
├── docs/                         # Producte, regles, dubtes, decisions
├── firebase.json                 # Configuració Firebase (hosting + firestore)
├── firestore.rules               # Security Rules
├── firestore.indexes.json
├── src/
│   ├── domain/                   # Regles de negoci pures (testable sense Firebase)
│   │   ├── types.ts              # Tipus del domini
│   │   ├── scoring.ts            # Càlcul de punts
│   │   ├── positions.ts          # Assignació de posicions amb empats densos
│   │   └── competition/          # Motor de brackets i fase de grups
│   ├── data/                     # Repositoris Firestore (1 per agregat)
│   ├── lib/                      # Inicialització Firebase
│   ├── features/                 # Pantalles per àrea
│   │   ├── auth/ participants/ events/ standings/ admin/
│   ├── ui/                       # Components compartits (layout, headers…)
│   ├── routes/                   # Router React
│   └── main.tsx                  # Entry point
├── index.html
├── package.json
├── tsconfig*.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.js
└── postcss.config.js
```

---

## Com contribuir (workflow de codi)

El flux està pensat per ser **simple però estricte**: tot el que entra a `main` ha de passar pels checks automàtics.

### 1. Branca

- `main` és la branca protegida. **No s'hi fa push directe.**
- Crea una branca nova per cada canvi. Convenció recomanada:

  ```
  feat/<nom-curt>       # noves funcionalitats
  fix/<nom-curt>        # correccions de bugs
  chore/<nom-curt>      # manteniment, config, refactors petits
  docs/<nom-curt>       # documentació
  ```

### 2. Commits

- Missatges curts, imperatius i en català o anglès de manera consistent.
- Es recomana (però no s'exigeix) [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

### 3. Pull Request

- Obre un **Pull Request** contra `main`.
- Descriu **què canvia**, **per què**, i com s'ha provat.
- Enllaça (si escau) la issue o la secció de `docs/` relacionada.
- Mantingues els PRs **petits i enfocats**. Un PR = un canvi coherent.
- Si el PR encara no està llest per revisar, obre'l com a **Draft**.

### 4. Checks obligatoris (GitHub Actions)

Abans de poder fer **merge**, el PR ha de passar **tots** els checks de CI:

- `lint` — `npm run lint` sense errors.
- `typecheck` — `npm run typecheck` sense errors.
- `test` — `npm run test` en verd.
- `build` — `npm run build` ha de completar-se correctament.

Les branques protegides estan configurades perquè **no es pugui fer merge si algun check falla**. Si un check falla, arregla-ho al teu branch i fes push; el workflow es tornarà a executar automàticament.

### 5. Revisió i merge

- Cal com a mínim **1 aprovació** d'un altre contribuïdor (o del manteniment) per fer merge.
- Les converses obertes del PR s'han de resoldre abans del merge.
- Estratègia de merge recomanada: **Squash and merge**, per mantenir `main` net i amb un commit per PR.
- Un cop fet merge, **esborra la branca** remota.

### 6. Qualitat i tests

- Afegeix tests quan aportin ROI clar (regles de negoci, puntuacions, càlcul de classificació, redistribució d'equips…). No cal TDD estricte.
- Mantingues el codi **modular i desacoblat**. Evita sobreenginyeria: l'MVP ha de ser simple.
- Si introdueixes un trade-off rellevant (puresa arquitectònica vs. velocitat), deixa-ho documentat al PR.

### 7. Configuració i secrets

- **Mai** pugis `.env.local` ni claus reals al repositori.
- Les claus de Firebase de desenvolupament es comparteixen fora del repo.
- Els secrets que necessiti CI (si n'hi ha) s'han de configurar com a **GitHub Actions secrets**.

---

## Llicència

Projecte intern. Llicència per definir.
