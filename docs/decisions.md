# Decisions de producte i arquitectura

Registre cronològic de les decisions preses durant la definició inicial.
Cada canvi de decisió ha d'afegir una entrada, no esborrar les antigues.

## Rols i auth

- Tres rols: `superadmin`, `admin`, públic (sense login).
- El superadmin pot crear, bloquejar (soft) o eliminar (hard) admins.
- Els participants no tenen login propi; poden consultar la classificació públicament.
- Rols es guarden a Firestore `/users/{uid}` amb camp `role` i `status`.
- A l'MVP les Security Rules llegeixen `/users/{uid}` per decidir autoritzacions.
  En fase 2 es pot migrar a custom claims amb una Cloud Function.

## Regles de puntuació

- Posició 1: 5 punts · Posició 2: 3 punts · Posició 3: 1 punt · Resta: 0.
- Bonus de +5 per assistència (per defecte, editable).
- Penalitzacions amb valor numèric lliure i comentari opcional (decidides per l'admin).
  Al MVP es manté com a camp numèric per permetre múltiples tipus (p. ex. -1 per tard, -3 per no avisar).
- **Empats densos**: dos equips empatats a la 1a posició reben 5 punts cadascun;
  el següent equip és la 2a posició i rep 3 punts (no es salta cap posició).
- Les puntuacions són individuals: en esports per equip cada membre rep els punts
  de la posició de l'equip + els seus propis modificadors d'assistència.

## Temporades

- Una sola temporada activa a la vegada.
- El superadmin tanca la temporada manualment. En tancar:
  - S'arxiva (status → `archived`).
  - Es mostra un popup de "fins a la següent temporada".
  - Les temporades passades queden consultables via navegació (no es perden dades).
- La classificació general es calcula com a agregat a la lectura (no persistida).

## Assistència

- L'admin introdueix l'assistència manualment (sense integració WhatsApp).
- Estats possibles (enum): `present`, `late`, `absent_notified`, `absent_unnotified`.
- Cada estat té bonus/penalització suggerits per defecte, però l'admin pot editar
  els valors cas per cas.
- Camp de comentari opcional per documentar la penalització.

## Formats de competició

Tres formats disponibles en crear l'esdeveniment:

1. **single_match** — un sol partit entre 2 equips/participants.
2. **bracket** — eliminatòria directa 1 vs 1 amb byes aleatoris si el nombre
   d'equips no és potència de 2.
3. **group_stage_bracket** — lligueta prèvia + bracket d'eliminatòries.
   - Mida de grup fixa de 3 o 4 equips (configurable per esdeveniment).
   - Round-robin complet dins de cada grup.
   - Els 2 primers de cada grup passen a l'eliminatòria.
   - Mínim 4 equips per poder escollir aquest format.
   - Desempats de grup: primer per punts, després decisió manual de l'admin (botó UI).

La puntuació general de la temporada només depèn de la **posició final** a
l'esdeveniment, no dels resultats de fases intermèdies.

## Stack tècnic

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + React Router.
- **Backend**: cap backend propi a l'MVP. Firestore accedit directament des del
  client, amb Security Rules com a font de veritat d'autorització.
- **Auth**: Firebase Authentication (email/password).
- **Hosting**: Firebase Hosting (Spark plan — gratuït).
- **Testing**: Vitest per al domini pur (scoring, posicions, motor de competició).
- **CI/CD**: GitHub Actions — CI executa typecheck + tests + build;
  deploy separat a Firebase en push a `main`.
- **Idioma de la UI**: català.

## Models de dades principals (Firestore)

Estructura jeràrquica amb subcol·leccions per fer les Security Rules més simples:

```
/users/{uid}                               # admins i superadmin
/seasons/{seasonId}                        # temporades
/seasons/{seasonId}/participants/{id}
/seasons/{seasonId}/events/{eventId}
/seasons/{seasonId}/events/{eventId}/teams/{id}
/seasons/{seasonId}/events/{eventId}/attendance/{participantId}
/seasons/{seasonId}/events/{eventId}/matches/{id}
/seasons/{seasonId}/events/{eventId}/finalStandings/{docId}
```

L'ID del document d'assistència és el `participantId` per garantir que només
hi ha un registre per participant/event.

## Fora de l'MVP (fase 2)

- Login de participants amb vista personal i historial propi.
- Reordenació manual de brackets després de generats.
- Exportació a CSV/Excel.
- Log d'auditoria del superadmin.
- Cloud Function per pujar rols a custom claims.

## Futur

- Integració WhatsApp (bot o enllaç ràpid).
- Notificacions push/email.
- Generador automàtic de calendari anual.
- Estadístiques per esport/participant.
- Live scoring durant l'esdeveniment.
