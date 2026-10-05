export function addScore(points, game) {
    // TODO (versi siswa): tambahkan points ke nilai score.
    // Petunjuk: score disimpan pada game.score; kembalikan nilai terbarunya.
    game.score += points;
    return game.score;
}
