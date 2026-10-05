import { GAME_STATES } from './gameState.js';
import { getDifficultySettings, moveTarget } from './targetLogic.js';

export function startGame(game) {
    // TODO (versi siswa): reset score, timer, combo, dan state ronde.
    // Petunjuk: solusi referensi ada di bawah; state awal ronde adalah COUNTDOWN.
    game.currentMode = game.currentMode || 'classic';
    game.score = 0;
    game.combo = 0;
    game.hits = 0;
    game.misses = 0;
    game.perfects = 0;
    game.bestCombo = 0;
    game.opponentScore = 0;
    game.opponentCombo = 0;
    game.opponentHits = 0;
    game.opponentMisses = 0;
    game.matchResult = '';
    game.movementState = 'IDLE';
    game.gameElapsed = 0;
    game.timeLeft = game.mode === 'MULTI' ? 0 : game.selectedTime;
    if (game.mode === 'MULTI') {
        game.hp = game.startingHp || 20;
        game.opponentHp = game.startingHp || 20;
    }
    game.comboTimer = 0;
    game.feedbackTimer = 0;
    game.leftHandSpeed = 0;
    game.rightHandSpeed = 0;
    game.leftPunchCooldown = 0;
    game.rightPunchCooldown = 0;
    game.leftHitArmed = true;
    game.rightHitArmed = true;
    game.survivalHp = 3;
    game.reflexPhase = 'waiting';
    game.reflexTargetTimer = 0;
    game.reflexTargetHit = false;
    game.comboFailed = false;
    game.pendingGameOverTimer = 0;
    game.slowMotionTimer = 0;
    game.slowMotionScale = 1;
    game.combatFeedback?.reset();
    game.hud.showLoading(false);
    game.resetTargetEffects?.();
    game.lastScoredAt = -Infinity;
    game.leftMotionSamples.length = 0;
    game.rightMotionSamples.length = 0;
    game.controllersInitialized = false;
    game.countdownRemaining = 3;
    game.status = 'GET READY 3';
    game.state = GAME_STATES.COUNTDOWN;

    game.targetAngle = 0;
    game.orbitChangeTimer = 0;
    game.orbitChangeDuration = 0;
    game.orbitDirection = Math.random() < 0.5 ? -1 : 1;
    const settings = getDifficultySettings(game);
    game.orbitSpeed = (settings.orbitMin + Math.random() * (settings.orbitMax - settings.orbitMin));
    game.desiredOrbitSpeed = game.orbitSpeed;
    game.desiredOrbitDirection = game.orbitDirection;
    game.orbitChangeDuration = settings.directionChangeMin +
        Math.random() * (settings.directionChangeMax - settings.directionChangeMin);
    moveTarget(0, game);

    game.target.visible = false;
    game.target.material.color.setHex(0xff3333);
    game.target.scale.setScalar(1);
    game.controllers.leftFist.scale.setScalar(1);
    game.controllers.rightFist.scale.setScalar(1);
    if (game.assets?.opponent) game.assets.opponent.visible = false;
    if (game.assets?.dummy) game.assets.dummy.visible = false;
    game.hud.show(false);
    game.hud.showCountdown(true);
    game.hud.setCountdownText('3', '#ffffff');
    game.gameOverDisplay.hide();
    game.status = 'GET READY 3';
}

export function updateCountdown(delta, game) {
    // TODO (versi siswa): selesaikan hitung mundur lalu ubah state ke PLAYING.
    // Petunjuk: countdownStepTimer berkurang dengan delta; tampilkan 3, 2, 1, GO.
    if (game.state !== GAME_STATES.COUNTDOWN) return;
    game.countdownRemaining = Math.max(0, game.countdownRemaining - delta);
    const currentCount = Math.ceil(game.countdownRemaining);
    if (currentCount >= 1) {
        game.hud.setCountdownText(String(currentCount), '#ffffff');
    } else {
        const startText = game.mode === 'MULTI' ? 'FIGHT!' : 'GO!';
        game.hud.setCountdownText(startText, '#66ff66');
        game.state = GAME_STATES.PLAYING;
        game.gameElapsed = 0;
        const combatant = game.mode === 'MULTI'
            ? game.assets?.opponent || game.assets?.dummy
            : game.assets?.dummy;
        game.target.visible = combatant == null;
        if (game.assets?.opponent) game.assets.opponent.visible = game.mode === 'MULTI';
        if (game.assets?.dummy) game.assets.dummy.visible = game.mode !== 'MULTI' || !game.assets.opponent;
        game.feedbackTimer = 0.8;
        game.status = startText;
        game.countdownRemaining = -999;
    }

    if (game.countdownRemaining < -0.45) game.hud.showCountdown(false);
}

export function gameOver(game) {
    // TODO (versi siswa): akhiri ronde satu kali dan tampilkan hasil akhir.
    // Petunjuk: ubah state, sembunyikan HUD/dummy, lalu panggil game.showGameOver(score).
    if (game.state === GAME_STATES.GAME_OVER) return;
    game.state = GAME_STATES.GAME_OVER;
    game.target.visible = false;
    game.hud.show(false);
    game.hud.showCountdown(false);
    game.status = 'GAME OVER';
    if (game.assets?.opponent) game.assets.opponent.visible = false;
    if (game.assets?.dummy) game.assets.dummy.visible = false;
    game.showGameOver(game.score, game.hits, game.misses, game.perfects, game.bestCombo);
}

