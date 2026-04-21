# Regles de negoci

## Entitats principals
- Participant
- Esdeveniment
- Equip
- Resultat
- Classificació

## Regles conegudes
- Hi ha un esdeveniment recurrent cada dues setmanes.
- Els participants poden assistir o no assistir a cada esdeveniment.
- Per cada esdeveniment es poden crear equips diferents de diferents tamanys.
- Els equips o participants obtenen una posició final segons el resultat de cada competició.
- La posició determina els punts rebuts.
- La classificació general s’actualitza acumulant punts al llarg del temps.

## Puntuació

### Regles confirmades
- La puntuació es calcula per participant, assistencia i/o equip.
- La posició 1 rep 5 punts.
- La posició 2 rep 3 punts.
- La posició 3 rep 1 punts.
- La resta de posicions reben 0
- Hi ha penalització quan no s'ha avisat de que no es ve previament al mateix dia a les 18:00 de la tarda i no assistencia de -3 punts
- Hi ha bonus quan s'assiteix de 5 punts

### Exemples
- Si un equip queda 1r, cada membre rep 5 punts.
- Si es un esport individual el 1r rep 5 punts
- Si un participant no assisteix, rep -3 punts
- Si hi ha empat, s’aplica el maxim de punts segons la posició en que s'hagi empatat

## Casos d’ús principals
- Afegir participant.
- Editar participant.
- Crear esdeveniment.
- Marcar assistència.
- Crear equips per a un esdeveniment.
- Assignar participants a equips.
- Redistribuir equips en un format de competició per poder determinar enfrontaments
- Introduir resultat final.
- Calcular puntuació.
- Consultar classificació general.
- Consultar historial d’esdeveniments.