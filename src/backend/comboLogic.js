const COMBO_WINDOW = 2.0;

export function updateCombo(hit, game) {
    // TODO (versi siswa): perbarui combo berdasarkan hasil hit.
    // Petunjuk: hit menambah combo; miss mengatur combo kembali sesuai aturan.
    game.combo = hit ? game.combo + 1 : 0;
    if (hit) game.bestCombo = Math.max(game.bestCombo || 0, game.combo);
    game.comboTimer = hit ? COMBO_WINDOW : 0;
    return game.combo;
}
