import { gameOver } from './gameLogic.js';
import { getDifficultySettings } from './targetLogic.js';

export function updateTimer(delta, game) {
    // TODO (versi siswa): hitung waktu dan akhiri ronde saat waktu habis.
    // Petunjuk: akumulasi delta, gunakan ceil untuk HUD, dan panggil gameOver(game).
    if (game.state !== 'PLAYING' || game.pendingGameOverTimer > 0) return;
    const multiplayer = game.mode === 'MULTI';
    const untimedSingleplayer = game.mode === 'SINGLE' &&
        (game.currentMode === 'survival' || game.currentMode === 'combo-chain');
    if (!multiplayer) {
        game.gameElapsed += delta;
        const nextTime = Math.max(0, Math.ceil(game.selectedTime - game.gameElapsed));
        if (!untimedSingleplayer && nextTime !== game.timeLeft) game.timeLeft = nextTime;
    }

    if (game.combo > 0) {
        game.comboTimer -= delta;
        if (game.comboTimer <= 0) {
            game.updateCombo(false);
            if (game.mode === 'SINGLE' && game.currentMode === 'combo-chain') {
                game.onComboFailed?.();
                return;
            }
        }
    }

    if (game.feedbackTimer > 0) {
        game.feedbackTimer -= delta;
        if (game.feedbackTimer <= 0) {
            const settings = getDifficultySettings(game);
            game.status = `NEED ${settings.minPunchSpeed.toFixed(1)}   PERFECT ${settings.perfectSpeed.toFixed(1)}`;
        }
    }

    if (!multiplayer && !untimedSingleplayer && game.gameElapsed >= game.selectedTime) {
        game.timeLeft = 0;
        gameOver(game);
    }
}
