/**
 * Càlcul de posicions amb empats densos.
 *
 * Regla: dos equips empatats a la 1a posició reben 1 cadascun; el següent és 2a.
 * No es salta cap posició (a diferència del rànquing "estàndard" 1,1,3).
 */
/**
 * Ordena equips per puntuació descendent i els assigna una posició
 * amb empats densos (1, 1, 2, 3, 3, 4...).
 */
export function assignDensePositions(inputs) {
    if (inputs.length === 0)
        return [];
    const sorted = [...inputs].sort((a, b) => b.score - a.score);
    const standings = [];
    let currentPosition = 1;
    let currentScore = sorted[0].score;
    let currentBucket = [];
    for (const entry of sorted) {
        if (entry.score === currentScore) {
            currentBucket.push(entry.teamId);
        }
        else {
            standings.push({ position: currentPosition, teamIds: currentBucket });
            currentPosition += 1;
            currentScore = entry.score;
            currentBucket = [entry.teamId];
        }
    }
    standings.push({ position: currentPosition, teamIds: currentBucket });
    return standings;
}
