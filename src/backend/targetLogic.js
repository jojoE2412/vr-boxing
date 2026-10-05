import * as THREE from 'three';

// TODO (versi siswa): pindahkan konfigurasi difficulty ke tabel agar mudah dibaca.
// Petunjuk: EASY, NORMAL, HARD mengatur kecepatan pukulan dan orbit target.
const MODE_MODIFIERS = {
    classic: { minPunchSpeed: 1, perfectSpeed: 1, orbitMin: 1, orbitMax: 1, directionChangeMin: 1, directionChangeMax: 1 },
    reflex: { minPunchSpeed: 1.05, perfectSpeed: 1.1, orbitMin: 1.25, orbitMax: 1.45, directionChangeMin: 0.7, directionChangeMax: 0.9 },
    'combo-chain': { minPunchSpeed: 1, perfectSpeed: 1.05, orbitMin: 0.95, orbitMax: 1.12, directionChangeMin: 0.85, directionChangeMax: 1.3 },
    survival: { minPunchSpeed: 1.1, perfectSpeed: 1.2, orbitMin: 1.12, orbitMax: 1.35, directionChangeMin: 0.6, directionChangeMax: 0.95 }
};

export const SINGLEPLAYER_MODES = Object.freeze({
    classic: { playerMovement: false, targetBehavior: 'orbit360' },
    reflex: { playerMovement: false, targetBehavior: 'rapidSpawn' },
    'combo-chain': { playerMovement: false, targetBehavior: 'sequence' },
    survival: { playerMovement: false, targetBehavior: 'dynamic' }
});

export function getSingleplayerModeConfig(game) {
    const modeKey = game?.currentMode || 'classic';
    return SINGLEPLAYER_MODES[modeKey] || SINGLEPLAYER_MODES.classic;
}

export function getDifficultySettings(game) {
    const presets = {
        EASY: { minPunchSpeed: 0.85, perfectSpeed: 1.70, orbitMin: 0.90, orbitMax: 1.25, directionChangeMin: 1.5, directionChangeMax: 2.8 },
        NORMAL: { minPunchSpeed: 1.20, perfectSpeed: 2.30, orbitMin: 1.30, orbitMax: 1.75, directionChangeMin: 1.0, directionChangeMax: 2.0 },
        HARD: { minPunchSpeed: 1.65, perfectSpeed: 2.80, orbitMin: 1.75, orbitMax: 2.45, directionChangeMin: 0.70, directionChangeMax: 1.45 }
    };
    const selected = presets[game.difficulty] || presets.NORMAL;
    const mode = MODE_MODIFIERS[game.currentMode || 'classic'] || MODE_MODIFIERS.classic;
    const survivalLevel = game.currentMode === 'survival'
        ? Math.floor((game.gameElapsed || 0) / 20)
        : 0;
    const survivalFactor = Math.min(1.8, 1 + survivalLevel * 0.12);
    return {
        ...selected,
        minPunchSpeed: selected.minPunchSpeed * mode.minPunchSpeed * survivalFactor,
        perfectSpeed: selected.perfectSpeed * mode.perfectSpeed * survivalFactor,
        orbitMin: selected.orbitMin * mode.orbitMin * survivalFactor,
        orbitMax: selected.orbitMax * mode.orbitMax * survivalFactor,
        directionChangeMin: selected.directionChangeMin * mode.directionChangeMin / survivalFactor,
        directionChangeMax: selected.directionChangeMax * mode.directionChangeMax / survivalFactor
    };
}

export function moveTarget(delta, game) {
    if (game.mode === 'MULTI') {
        return applyOrbitTarget(delta, game, game.arenaAnchor || game.playerAnchor);
    }

    const modeConfig = getSingleplayerModeConfig(game);
    switch (modeConfig.targetBehavior) {
        case 'rapidSpawn':
            return applyRapidReflexTarget(delta, game);
        case 'sequence':
            return applyComboSequenceTarget(delta, game);
        case 'dynamic':
            return applyOrbitTarget(delta, game, game.playerAnchor);
        case 'orbit360':
        default:
            return applyOrbitTarget(delta, game, game.playerAnchor);
    }
}

function applyOrbitTarget(delta, game, anchor) {
    if (game.orbitChangeDuration <= 0 || game.orbitChangeTimer >= game.orbitChangeDuration) {
        const settings = getDifficultySettings(game);
        game.desiredOrbitDirection = Math.random() < 0.5 ? 1 : -1;
        game.desiredOrbitSpeed = randomBetween(settings.orbitMin, settings.orbitMax);
        game.orbitChangeDuration = randomBetween(settings.directionChangeMin, settings.directionChangeMax);
        game.orbitChangeTimer = 0;
    }

    game.orbitChangeTimer += delta;
    game.orbitDirection = damp(game.orbitDirection, game.desiredOrbitDirection, 8, delta);
    game.orbitSpeed = damp(game.orbitSpeed, game.desiredOrbitSpeed, 5, delta);
    game.targetAngle += game.orbitDirection * game.orbitSpeed * delta;

    const x = anchor.x + Math.sin(game.targetAngle) * game.targetRadius;
    const z = anchor.z - Math.cos(game.targetAngle) * game.targetRadius;
    game.target.position.set(x, game.playerAnchor.y, z);
    game.target.lookAt(game.playerAnchor);
}

function applyRapidReflexTarget(delta, game) {
    const difficulty = game.difficulty || 'NORMAL';
    const waitTime = difficulty === 'HARD' ? 0.10 : difficulty === 'EASY' ? 0.35 : 0.22;
    const visibleTime = difficulty === 'HARD' ? 0.72 : difficulty === 'EASY' ? 1.25 : 0.95;
    const riseDuration = 0.18;
    const hideDuration = 0.16;
    const phase = game.reflexPhase || 'waiting';
    game.reflexTargetTimer = (game.reflexTargetTimer || 0) + delta;

    if (phase === 'waiting') {
        game.target.visible = false;
        if (game.reflexTargetTimer < waitTime) return;
        game.reflexTargetTimer = 0;
        game.reflexTargetIndex = Math.floor(Math.random() * 3);
        game.reflexBasePosition = getFrontTargetPosition(game, [-0.50, 0, 0.50][game.reflexTargetIndex]);
        game.reflexPhase = 'rising';
    }

    if (game.reflexPhase === 'rising') {
        const progress = Math.min(1, game.reflexTargetTimer / riseDuration);
        game.target.position.copy(game.reflexBasePosition);
        game.target.position.y -= (1 - progress) * 0.28;
        game.target.scale.setScalar(0.82 + progress * 0.18);
        game.target.visible = true;
        game.target.lookAt(game.playerAnchor);
        if (progress >= 1) {
            game.reflexPhase = 'active';
            game.reflexTargetTimer = 0;
        }
        return;
    }

    if (game.reflexPhase === 'active') {
        game.target.position.copy(game.reflexBasePosition);
        game.target.visible = true;
        game.target.lookAt(game.playerAnchor);
        if (game.reflexTargetHit) {
            game.reflexTargetHit = false;
            game.reflexPhase = 'disappearing';
            game.reflexTargetTimer = 0;
        } else if (game.reflexTargetTimer >= visibleTime) {
            game.onMiss?.('left', 'timeout');
            game.reflexPhase = 'disappearing';
            game.reflexTargetTimer = 0;
        }
        return;
    }

    if (game.reflexPhase === 'disappearing') {
        const progress = Math.min(1, game.reflexTargetTimer / hideDuration);
        game.target.scale.setScalar(1 - progress * 0.35);
        if (progress >= 1) {
            game.target.visible = false;
            game.target.scale.setScalar(1);
            game.reflexPhase = 'waiting';
            game.reflexTargetTimer = 0;
        }
    }
}

function applyComboSequenceTarget(delta, game) {
    game.target.position.copy(getFrontTargetPosition(game));
    game.target.visible = true;
    game.target.lookAt(game.playerAnchor);
}

function getFrontTargetPosition(game, horizontalOffset = 0) {
    const radius = game.targetRadius || 0.70;
    const depth = -Math.sqrt(Math.max(0, radius * radius - horizontalOffset * horizontalOffset));
    const position = new THREE.Vector3(
        horizontalOffset,
        game.playerAnchor.y - game.playerRoot.position.y,
        depth
    );
    return game.playerRoot.localToWorld(position);
}

function damp(current, target, smoothing, delta) {
    // TODO (versi siswa): haluskan perubahan nilai tanpa bergantung pada FPS.
    // Petunjuk: faktor peredam dapat dihitung dengan eksponen dan delta time.
    const amount = 1 - Math.exp(-smoothing * delta);
    return current + (target - current) * amount;
}

function randomBetween(min, max) {
    // TODO (versi siswa): ambil angka acak dalam rentang yang diberikan.
    // Petunjuk: min + Math.random() dikali selisih max dan min.
    return min + Math.random() * (max - min);
}
