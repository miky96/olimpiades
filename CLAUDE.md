# Instruccions operatives per a aquest projecte

## Creació i edició de fitxers — evitar truncaments i desincronitzacions

Aquestes regles són d'aplicació **obligatòria i sistemàtica** per evitar el problema recurrent en què Read veu el fitxer correctament però el mount de bash el veu truncat (o viceversa).

### 1. Un sol carril per fitxer dins d'una mateixa tasca
- Si un fitxer es comença amb `Write`/`Edit`, acabar-lo amb `Write`/`Edit`.
- Si es genera via `bash` (heredoc, script Python, etc.), mantenir-ho tot dins bash.
- **No barrejar** Edit + modificacions via bash sobre el mateix fitxer en el mateix flux.

### 2. Fitxers llargs (>200 línies) → generació d'una sola passada
- Evitar el patró "Write inicial + molts Edits incrementals" en fitxers grans.
- Preferir:
  - Un únic `Write` amb el contingut complet, **o bé**
  - Generació via bash amb `cat > fitxer << 'EOF' ... EOF`, **o bé**
  - Un script Python que escrigui el fitxer sencer d'una vegada.

### 3. Verificació obligatòria després d'escriptures no trivials
Després de crear o reescriure qualsevol fitxer de >50 línies, executar a bash:
```
wc -l <fitxer> && tail -5 <fitxer>
```
Confirmar que el recompte i l'últim bloc coincideixen amb l'esperat abans de continuar treballant sobre el fitxer.

### 4. No rellegir immediatament després d'un Edit reeixit
Si `Edit` no ha retornat error, el canvi és correcte a nivell lògic. Rellegir força re-sincronitzacions que poden desencadenar desajustos. Confiar en el resultat i continuar.

### 5. Preferir modularitat des del principi
Per a components React, mòduls backend, etc., dividir en fitxers més petits (idealment <200 línies) en lloc de crear mega-fitxers. Redueix l'exposició al problema i és millor pràctica igualment.

### 6. Si apareix un truncament
- No intentar "reparar" el fitxer amb més `Edit`s iteratius.
- Reescriure el fitxer sencer amb `Write` o via bash heredoc.
- Verificar amb `wc -l` abans de donar la feina per acabada.
