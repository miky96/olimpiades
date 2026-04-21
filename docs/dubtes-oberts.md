# Dubtes oberts

## Assistència
- L’assistència s’introdueix manualment o s’ha d’integrar amb WhatsApp?

## Usuaris i permisos
- Els participants tindran login propi?
- Els participants podran consultar classificació i historial?

## Tècnic
- Quin stack concret volem per frontend i backend?
- Quina base de dades volem fer servir?
- La integració amb WhatsApp és realment necessària per a l’MVP?


Són menors i no bloquejants per començar a dissenyar, però convé tancar-los abans o durant la implementació:
Sobre el format lligueta + eliminatòria: (a) vols fixar una mida de grup "ideal" (3 o 4 equips) i que el sistema ho decideixi segons el nombre d'equips, o vols triar-la cada vegada? 
Esta be fixar una mida del grup i que segons els equips es fagin X grups segons la mida ideal

(b) quants partits ha de jugar cada equip dins del grup? — el mínim raonable seria n-1 (tots contra tots dins del grup), o podem fer-ne menys amb un calendari aleatori balancejat, però això complica el desempat intern del grup. La meva recomanació pragmàtica és round-robin dins del grup (amb grups petits de 3 o 4, són 2 o 3 partits per equip, totalment assumible).
Fem com tu dius amb equips de 3 o 4. Dona les dues opcions perque es molt variat els grups es poden anar creant segons els equips que hi hagi o inclus si hi ha menys de x equips (4) no deixar crear aquesta lligueta.

 (c) desempat dins del grup per decidir qui passa: punts de grup → diferència d'"anotació"/score → sorteig? 
 Em sembla be el que proposes de desempat manual amb botó


Sobre el bracket eliminatori: si el nombre d'equips classificats no és potència de 2 (ex. 6 o 10), l'MVP permet "byes" (passen directament a la ronda següent) assignats aleatòriament?
si em sembla bé el byes

Sobre la puntuació general: assumeixo que els 5/3/1 es donen per la posició final de l'esdeveniment (el que determina la classificació general de la temporada), no per fases intermèdies. Confirmes?
Si la puntuació es per posició final

Sobre el valor de la penalització: a la teva resposta has mencionat un exemple de "-1 punt per arribar tard". Vols que la penalització sigui:

opció A) un checkbox de "penalitzar" que sempre resta -3 (com diuen les regles originals), o
opció B) un camp numèric lliure on l'admin pot posar qualsevol quantitat (p. ex. -1, -3, -5)?

Fes la opció B perque de moment tenim dues penalitzacions (arribar tard o no apareixer sense avisar) i poden apareixer mes en el futur

Sobre el superadmin: "bloquejar admins" significa desactivar-los temporalment (sense poder entrar), eliminar-los definitivament, o tots dos? Fes ambdues accions

Sobre quan es tanca una temporada: ho fa el superadmin manualment, o quan s'han celebrat tots els X esdeveniments planificats? Manualment i ho fa el super admin