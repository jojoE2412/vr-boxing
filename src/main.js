import * as THREE from 'three';
import './style.css';
import { initScene } from './frontend/scene.js';
import { loadAssets } from './frontend/assets.js';
import { initControllers } from './frontend/controllers.js';
import { createHitbox, updateHitbox, getTargetHitbox } from './frontend/hitbox.js';
import { initXR, exitVR } from './frontend/xr.js';
import { initUI } from './frontend/ui.js';
import { initHUD } from './frontend/hud.js';
import { initAudio } from './frontend/audio.js';
import { initGameOver } from './frontend/gameOver.js';
import { placeDummy, placeOpponent } from './frontend/assetPositions.js';
import { GAME_STATES } from './backend/gameState.js';
import { gameOver as finishGame, startGame, updateCountdown } from './backend/gameLogic.js';
import { moveTarget } from './backend/targetLogic.js';
import { detectPunch } from './backend/punchLogic.js';
import { updateTimer } from './backend/timerLogic.js';
import { addScore } from './backend/scoreLogic.js';
import { updateCombo } from './backend/comboLogic.js';
import { createMultiplayerClient } from './frontend/multiplayer.js';
import { initDesktopControls, PC_CONTROL_ENABLED } from './frontend/desktopControls.js';
import { updateVRLocomotion } from './frontend/vrLocomotion.js';
import { PlayerAnimationController } from './frontend/playerAnimationController.js';
import { initCombatFeedback } from './frontend/combatFeedback.js';
import { triggerHaptic } from './frontend/haptics.js';

const { scene, camera, renderer, playerMarker, playerRoot } = initScene();
const controllers = initControllers(renderer, playerRoot);
const audio = initAudio();
const hud = initHUD(scene, camera, renderer);
const combatFeedback = initCombatFeedback(scene, camera, renderer);
const hitbox = createHitbox();
const playerAnchor = new THREE.Vector3(0, 1.6, 0);
const arenaAnchor = new THREE.Vector3(0, 0, 0);
const target = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.80, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xff3333 })
);
target.material.visible = false;
target.position.set(0, playerAnchor.y, -0.70);
target.visible = false;
const targetRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.016, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0x62d7ff, transparent: true, opacity: 0.78 })
);
targetRing.position.z = 0.13;
targetRing.visible = false;
scene.add(target);
scene.add(targetRing);

const game = {
    state: GAME_STATES.MENU,
    score: 0,
    combo: 0,
    timeLeft: 30,
    hits: 0,
    misses: 0,
    perfects: 0,
    bestCombo: 0,
    status: 'SIAP',
    mode: 'SINGLE',
    playerNumber: 0,
    playerRoot,
    movementState: 'IDLE',
    desktopActive: false,
    roomCode: '',
    returnToRoomLobby: false,
    opponentScore: 0,
    opponentCombo: 0,
    opponentHits: 0,
    opponentMisses: 0,
    hp: 20,
    startingHp: 20,
    opponentHp: 20,
    opponentPlayer: {
        position: new THREE.Vector3(0, 0, -1.25),
        networkPosition: new THREE.Vector3(0, 0, -1.25),
        rotation: new THREE.Euler(0, Math.PI, 0),
        networkRotation: new THREE.Euler(0, Math.PI, 0),
        movementState: 'IDLE',
        action: '',
        actionUntil: 0,
        actionStarted: 0,
        actionId: 0,
        animationActionId: ''
    },
    matchResult: '',
    difficulty: 'NORMAL',
    currentMode: 'classic',
    selectedTime: 30,
    targetAngle: 0,
    orbitDirection: 1,
    orbitSpeed: 1.4,
    targetRadius: 0.70,
    leftMotionSamples: [],
    rightMotionSamples: [],
    leftHandSpeed: 0,
    rightHandSpeed: 0,
    controllersInitialized: false,
    vrSessionActive: false,
    vrGameInitialized: false,
    assetsReady: false,
    matchLoadingUntil: 0,
    leftPunchCooldown: 0,
    rightPunchCooldown: 0,
    leftHitArmed: true,
    rightHitArmed: true,
    onPunch: hand => {
        if (game.mode === 'MULTI') {
            multiplayer.sendAction(hand === 'left' ? 'LEFT_PUNCH' : 'RIGHT_PUNCH')
                .catch(error => console.warn('[MULTIPLAYER]', error));
        }
    },
    onPunchResult: (hand, result) => {
        if (game.mode !== 'MULTI') return;
        multiplayer.sendPunchResult(hand, result)
            .catch(error => console.warn('[MULTIPLAYER]', error));
        if (result !== 'MISS') {
            assets?.opponentAnimationController?.playHitReaction();
            combatFeedback.show(result === 'PERFECT' ? '-2 HP' : '-1 HP', 'hp', assets?.opponent || null);
        }
    },
    addScore: points => addScore(points, game),
    updateCombo: hit => updateCombo(hit, game),
    combatFeedback,
    scene, camera, renderer, controllers, playerAnchor, arenaAnchor, target, hitbox, hud, audio
};
let ui;
let gameOver;
const multiplayer = createMultiplayerClient(message => {
    if (message.type === 'room-state') {
        game.roomCode = message.roomCode;
        game.playerNumber = message.playerNumber;
        if (message.settings) {
            game.difficulty = message.settings.difficulty;
            game.selectedTime = message.settings.duration;
        }
        setOpponentSpawn();
        ui?.setRoomState(message);
    } else if (message.type === 'room-error') {
        ui?.setRoomStatus(message.message);
    } else if (message.type === 'opponent-state') {
        game.opponentPlayer.networkPosition.set(message.position.x, message.position.y, message.position.z);
        game.opponentPlayer.networkRotation.set(message.rotation.x, message.rotation.y, message.rotation.z);
        game.opponentPlayer.movementState = message.movementState;
        game.opponentScore = message.score;
        game.opponentCombo = message.combo;
        game.opponentHits = message.hits;
        game.opponentMisses = message.misses;
    } else if (message.type === 'opponent-action') {
        playOpponentAction(message.action, message.actionId);
    } else if (message.type === 'opponent-result') {
        console.info(`[NETWORK] ${message.result}`);
        if (message.result === 'HIT' || message.result === 'PERFECT') {
            game.triggerHaptic(message.hand, message.result === 'PERFECT' ? 0.95 : 0.58,
                message.result === 'PERFECT' ? 180 : 90);
        }
        const labels = { HIT: 'YOU WERE HIT', MISS: 'OPPONENT MISS', PERFECT: 'PERFECT!' };
        combatFeedback.show(
            labels[message.result] || 'OPPONENT ACTION',
            message.result === 'PERFECT' ? 'perfect' : message.result === 'MISS' ? 'miss' : 'hit',
            game.getCombatFeedbackAnchor()
        );
    } else if (message.type === 'opponent-score') {
        game.opponentScore = message.score;
    } else if (message.type === 'health-state') {
        for (const player of message.players || []) {
            if (player.playerNumber === game.playerNumber) {
                game.hp = player.hp;
            } else {
                game.opponentHp = player.hp;
            }
        }
    } else if (message.type === 'start') {
        game.opponentScore = 0;
        game.startingHp = message.startingHp || 20;
        game.hp = game.startingHp;
        game.opponentHp = game.startingHp;
        game.matchResult = '';
        game.pendingNetworkStart = true;
        game.pendingNetworkStartAt = performance.now() + Math.max(0, Number(message.startInMs) || 0);
        if (game.vrSessionActive || game.desktopActive) {
            hud.showLoading(true);
            game.matchLoadingUntil = performance.now() + 700;
        }
        assets?.opponentAnimationController?.playIdle();
        gameOver?.setMatchResult('');
        if (game.playerNumber === 2 && !game.vrSessionActive) {
            preparePlayerTwoStart();
        } else {
            game.status = 'MATCH STARTING';
        }
    } else if (message.type === 'match-result') {
        game.matchResult = message.winnerNumber === 0
            ? 'DRAW'
            : message.winnerNumber === game.playerNumber ? 'YOU WIN' : 'YOU LOSE';
        game.matchScores = message.scores;
        game.hp = message.scores.find(player => player.playerNumber === game.playerNumber)?.hp ?? game.hp;
        game.opponentHp = message.scores.find(player => player.playerNumber !== game.playerNumber)?.hp ?? game.opponentHp;
        if (game.matchResult === 'YOU WIN') assets?.opponentAnimationController?.playDefeat();
        else if (game.matchResult === 'YOU LOSE') assets?.opponentAnimationController?.playVictory();
        else assets?.opponentAnimationController?.playIdle();
        if (game.state !== GAME_STATES.GAME_OVER) {
            game.state = GAME_STATES.GAME_OVER;
            game.showGameOver(game.score, game.hits, game.misses, game.perfects, game.bestCombo);
        }
        gameOver?.setMatchResult(game.matchResult, message.scores, game.playerNumber);
    } else if (message.type === 'opponent-disconnected') {
        game.status = 'OPPONENT DISCONNECTED';
        ui?.setRoomStatus('Opponent disconnected. Rejoin the room to play again.');
    } else if (message.type === 'disconnected') {
        game.roomCode = '';
        game.playerNumber = 0;
        ui?.setRoomState({ roomCode: '', players: 0, playerNumber: 0 });
        ui?.setRoomStatus('Multiplayer connection closed.');
    }
});
function returnToMultiplayerRoom() {
    if (game.mode !== 'MULTI') return false;
    combatFeedback.reset();
    gameOver?.hide();
    game.pendingGameOverTimer = 0;
    game.status = 'WAITING FOR OPPONENT';
    hud.showLoading(false);

    if (renderer.xr.isPresenting) {
        game.returnToRoomLobby = true;
        game.state = GAME_STATES.WAITING_XR;
        exitVR(renderer).catch(error => console.warn('[XR]', error));
        return true;
    }

    desktopControls.stop();
    game.desktopActive = false;
    game.state = GAME_STATES.MENU;
    setGlovesVisible(false);
    hud.show(false);
    hud.showCountdown(false);
    ui?.showStartScreen();
    ui?.setRoomStatus('Ready when you are. The host starts the match after both players are ready.');
    return true;
}

const desktopControls = initDesktopControls({
    camera,
    canvas: renderer.domElement,
    playerRoot,
    onExit: () => {
        multiplayer.leaveRoom();
        desktopControls.stop();
        game.desktopActive = false;
        setGlovesVisible(true);
        game.state = GAME_STATES.MENU;
        game.roomCode = '';
        game.playerNumber = 0;
        ui.setRoomState({ roomCode: '', players: 0, playerNumber: 0 });
        ui.setRoomStatus('Room left. Create a room or enter a room code.');
        hud.show(false);
        hud.showCountdown(false);
        hud.showLoading(false);
        gameOver.hide();
        ui.showStartScreen();
    },
    onPlayAgain: () => {
        if (game.state !== GAME_STATES.GAME_OVER) return;
        returnToMultiplayerRoom();
    }
});
function setGlovesVisible(visible) {
    if (assets?.leftGlove) assets.leftGlove.visible = visible;
    if (assets?.rightGlove) assets.rightGlove.visible = visible;
}
function startPlayerTwoOnDesktop() {
    if (!PC_CONTROL_ENABLED) {
        ui?.setRoomStatus('This player needs a supported VR headset to join the match.');
        return;
    }
    setPlayerSpawn();
    setGlovesVisible(false);
    game.desktopActive = true;
    hud.showLoading(true);
    game.matchLoadingUntil = performance.now() + 700;
    desktopControls.start();
    ui?.hideStartScreen();
}

function preparePlayerTwoStart() {
    const xr = navigator.xr;
    const headsetBrowser = /Quest|OculusBrowser|PicoBrowser/i.test(navigator.userAgent);
    if (!xr?.isSessionSupported) {
        if (headsetBrowser) ui?.promptXRJoin();
        else startPlayerTwoOnDesktop();
        return;
    }
    xr.isSessionSupported('immersive-vr').then(supported => {
        if (supported || headsetBrowser) ui?.promptXRJoin();
        else startPlayerTwoOnDesktop();
    }).catch(() => {
        if (headsetBrowser) ui?.promptXRJoin();
        else startPlayerTwoOnDesktop();
    });
}

gameOver = initGameOver({
    scene, camera, renderer, controllers,
    onPlayAgain: () => {
        if (game.mode === 'MULTI') {
            returnToMultiplayerRoom();
        } else {
            setGlovesVisible(true);
            startGame(game);
        }
    },
    onHome: () => exitVR(renderer)
});
game.gameOverDisplay = gameOver;
game.showGameOver = (score, hits, misses, perfects, bestCombo) => {
    combatFeedback.reset();
    setGlovesVisible(false);
    gameOver.show(score, hits, misses, perfects, bestCombo, game.mode, game.playerNumber, {
        currentMode: game.currentMode,
        elapsed: game.gameElapsed,
        duration: game.selectedTime,
        survivalHp: game.survivalHp,
        hp: game.hp,
        opponentHp: game.opponentHp,
        startingHp: game.startingHp,
        matchResult: game.matchResult,
        matchScores: game.matchScores || []
    });
};
game.getTargetHitbox = () => getTargetHitbox(hitbox);
game.getCombatFeedbackAnchor = () => game.mode === 'MULTI' ? assets?.opponent || null : null;
game.triggerHaptic = (hand, intensity, duration) =>
    triggerHaptic(hand, intensity, duration, renderer);
game.triggerSlowMotion = () => {
    game.slowMotionTimer = 0.24;
    game.slowMotionScale = 0.32;
};
game.resetTargetEffects = () => {
    game.targetFlashTimer = 0;
    target.material.color.setHex(0xff3333);
    target.scale.setScalar(1);
    targetRing.material.color.setHex(0x62d7ff);
    targetRing.material.opacity = 0.78;
    targetRing.scale.setScalar(1);
    targetRing.visible = false;
};
game.flashTarget = perfect => {
    game.targetFlashTimer = perfect ? 0.42 : 0.28;
    game.targetFlashDuration = game.targetFlashTimer;
    game.targetFlashStrength = perfect ? 1.8 : 1;
    target.material.color.setHex(perfect ? 0xffe066 : 0x6bffb0);
    targetRing.material.color.setHex(perfect ? 0xfff06a : 0x6bffb0);
    targetRing.material.opacity = 1;
};
game.onTargetHit = () => {
    if (game.currentMode === 'reflex') game.reflexTargetHit = true;
};
game.onMiss = (hand = 'left', reason = 'swing') => {
    game.misses += 1;
    game.updateCombo(false);
    if (reason !== 'timeout') game.triggerHaptic(hand, 0.24, 55);
    game.audio.play('miss', 0.45);
    combatFeedback.show(`MISS ${game.misses}`, 'miss');

    if (game.currentMode === 'survival') {
        game.survivalHp = Math.max(0, game.survivalHp - 1);
        combatFeedback.show(`-1 HP\n${game.survivalHp}/3`, 'hp');
        if (game.survivalHp === 0) {
            combatFeedback.reset();
            combatFeedback.show('-1 HP\n0/3', 'hp');
            game.pendingGameOverTimer = 0.9;
        }
    }

    if (game.currentMode === 'combo-chain') {
        game.onComboFailed();
    }
};
game.onComboFailed = () => {
    if (game.comboFailed || game.currentMode !== 'combo-chain') return;
    game.comboFailed = true;
    combatFeedback.reset();
    combatFeedback.show('COMBO FAILED', 'failed');
    game.pendingGameOverTimer = 0.9;
};

ui = initUI({
    renderer,
    audio,
    multiplayer,
    onMode: value => { game.mode = value; },
    onCurrentMode: value => { game.currentMode = value || 'classic'; },
    onDifficulty: value => { game.difficulty = value; },
    onDuration: value => { game.selectedTime = value; },
    pcControlsEnabled: PC_CONTROL_ENABLED,
    onLeaveRoom: () => {
        game.roomCode = '';
        game.playerNumber = 0;
        game.desktopActive = false;
        desktopControls.stop();
        setGlovesVisible(true);
        game.state = GAME_STATES.MENU;
    },
    onStartKeyboard: () => {
        setPlayerSpawn();
        setGlovesVisible(false);
        game.desktopActive = true;
        game.pendingNetworkStart = false;
        desktopControls.start();
        ui.hideStartScreen();
        game.state = GAME_STATES.WAITING_XR;
        game.status = 'WAITING FOR VR PLAYER';
        hud.show(false);
        multiplayer.setReady().then(() => {
            if (game.playerNumber === 1) return multiplayer.startMatch();
        }).catch(error => console.warn('[MULTIPLAYER]', error));
    }
});

let assets = null;
let stateSyncTimer = 0;
loadAssets(scene, controllers, target, playerAnchor).then(result => {
    assets = result;
    game.assets = result;
    game.assetsReady = true;
    if (assets.opponentAnimations?.length) {
        assets.opponentAnimations = assets.opponentAnimations.map(clip => new THREE.AnimationClip(
            clip.name,
            clip.duration,
            clip.tracks.filter(track => !/^(?:ORG|DEF)-shoulder[LR]_\d+\.(?:position|quaternion|scale)$/.test(track.name))
        ));
        assets.opponentAnimationController = new PlayerAnimationController(
            assets.opponent,
            assets.opponentAnimations
        );
        assets.opponentAnimationController.playIdle();
        dispatchOpponentAction();
    }
    const combatant = assets.opponent || assets.dummy;
    if (combatant) {
        target.visible = false;
        combatant.visible = game.state === GAME_STATES.PLAYING;
    }
}).catch(error => {
    console.error('[ASSETS] Failed to load:', error);
    game.assetsReady = true;
});

initXR(renderer, {
    onSessionStart: () => {
        game.vrSessionActive = true;
        game.vrGameInitialized = false;
        game.state = 'WAITING_XR';
        if (game.pendingNetworkStart) {
            hud.showLoading(true);
            game.matchLoadingUntil = performance.now() + 700;
        }
        ui.hideStartScreen();
    },
    onSessionEnd: () => {
        const keepRoom = game.returnToRoomLobby;
        game.returnToRoomLobby = false;
        if (!keepRoom) multiplayer.leaveRoom();
        setGlovesVisible(true);
        game.vrSessionActive = false;
        game.vrGameInitialized = false;
        game.desktopActive = false;
        desktopControls.stop();
        game.controllersInitialized = false;
        game.leftMotionSamples.length = 0;
        game.rightMotionSamples.length = 0;
        game.state = GAME_STATES.MENU;
        if (!keepRoom) {
            game.roomCode = '';
            game.playerNumber = 0;
        }
        game.opponentScore = 0;
        game.pendingNetworkStart = false;
        game.matchLoadingUntil = 0;
        if (assets?.dummy) assets.dummy.visible = false;
        hud.show(false);
        gameOver.hide();
        hud.showCountdown(false);
        hud.showLoading(false);
        ui.showStartScreen();
        if (keepRoom) {
            ui.setRoomStatus('Ready when you are. The host starts the match after both players are ready.');
        } else {
            ui.setRoomState({ roomCode: '', players: 0, playerNumber: 0 });
            ui.setRoomStatus('Room left. Create a room or enter a room code.');
        }
    }
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
    const delta = THREE.MathUtils.clamp(clock.getDelta(), 0.001, 0.05);
    if (game.pendingGameOverTimer > 0) {
        game.pendingGameOverTimer = Math.max(0, game.pendingGameOverTimer - delta);
        if (game.pendingGameOverTimer === 0) finishGame(game);
    }
    if (game.slowMotionTimer > 0) {
        game.slowMotionTimer = Math.max(0, game.slowMotionTimer - delta);
    } else {
        game.slowMotionScale = THREE.MathUtils.damp(game.slowMotionScale ?? 1, 1, 14, delta);
    }
    const targetDelta = delta * (game.slowMotionScale ?? 1);

    if (renderer.xr.isPresenting) {
        updateVRLocomotion(renderer, delta, game);
        playerRoot.updateMatrixWorld(true);
        renderer.xr.getCamera(camera).getWorldPosition(playerAnchor);
        playerAnchor.y = 1.60;
        if (!game.controllersInitialized) {
            controllers.left.getWorldPosition(controllers.previousLeftPosition);
            controllers.right.getWorldPosition(controllers.previousRightPosition);
            game.controllersInitialized = true;
        }
    }

    if (desktopControls.active) {
        const allowDesktopMovement = game.mode === 'MULTI' && game.state === GAME_STATES.PLAYING;
        desktopControls.setMovementEnabled(allowDesktopMovement);
        desktopControls.update(delta, allowDesktopMovement);
        camera.getWorldPosition(playerAnchor);
        game.movementState = desktopControls.movementState;
    }

    // Keep the floor anchor attached to the player's current position as they move.
    if (game.mode === 'MULTI' && playerMarker.visible && game.playerNumber) {
        playerRoot.getWorldPosition(playerMarker.position);
        playerMarker.position.y = 0.01;
    }

    if (game.mode === 'MULTI' && game.playerNumber &&
        (game.vrSessionActive || game.desktopActive) && game.state !== GAME_STATES.MENU) {
        stateSyncTimer += delta;
        if (stateSyncTimer >= 1 / 30) {
            stateSyncTimer = 0;
            multiplayer.sendPlayerState({
                position: playerRoot.position,
                rotation: getPlayerFacingRotation(),
                movementState: game.movementState,
                score: game.score,
                combo: game.combo,
                hits: game.hits,
                misses: game.misses,
                timeLeft: game.timeLeft
            }).catch(error => console.warn('[MULTIPLAYER]', error));
        }
    }

    if (game.vrSessionActive && !game.vrGameInitialized && renderer.xr.getSession()) {
        setPlayerSpawn();
        playerMarker.position.set(playerRoot.position.x, 0.01, playerRoot.position.z);
        game.vrGameInitialized = true;
        if (game.mode === 'MULTI') {
            game.state = GAME_STATES.WAITING_XR;
            game.status = game.playerNumber === 2
                ? 'READY - WAITING FOR HOST TO START'
                : 'WAITING FOR PLAYER 2';
            if (game.playerNumber === 1) {
                multiplayer.setReady().then(() => multiplayer.startMatch()).catch(error => {
                    game.status = 'MULTIPLAYER CONNECTION ERROR';
                    console.warn('[MULTIPLAYER]', error);
                });
            } else {
                combatFeedback.show('READY\nWAITING FOR HOST', 'hp');
            }
        } else {
            startGame(game);
        }
    }

    if (game.pendingNetworkStart && (game.vrSessionActive || game.desktopActive) &&
        game.assetsReady && performance.now() >= game.pendingNetworkStartAt &&
        performance.now() >= game.matchLoadingUntil) {
        game.pendingNetworkStart = false;
        startGame(game);
    }

    if (game.state === GAME_STATES.COUNTDOWN) updateCountdown(delta, game);

    if (game.state === GAME_STATES.PLAYING && game.mode !== 'MULTI') {
        moveTarget(targetDelta, game);
    }

    if (game.mode === 'MULTI' && assets?.opponent) {
        game.opponentPlayer.position.lerp(game.opponentPlayer.networkPosition, 1 - Math.exp(-14 * delta));
        const rotationDelta = Math.atan2(
            Math.sin(game.opponentPlayer.networkRotation.y - game.opponentPlayer.rotation.y),
            Math.cos(game.opponentPlayer.networkRotation.y - game.opponentPlayer.rotation.y)
        );
        const rotationStep = rotationDelta * (1 - Math.exp(-18 * delta));
        game.opponentPlayer.rotation.y += rotationStep;
        // The boxer model's local forward axis is +X; rotate it onto the
        // networked player-facing direction for both sides of the match.
        placeOpponent(assets.opponent, game.opponentPlayer.position, game.opponentPlayer.rotation, Math.PI / 2);
        if (game.opponentPlayer.actionUntil <= performance.now()) game.opponentPlayer.action = '';
        assets.opponentAnimationController?.update(delta, game.opponentPlayer.movementState);
        assets.opponent.updateMatrixWorld(true);
        updateHitbox(hitbox, assets.opponent);
        assets.opponent.visible = game.state === GAME_STATES.PLAYING;
        target.position.set(
            game.opponentPlayer.position.x,
            game.opponentPlayer.position.y + 1.15,
            game.opponentPlayer.position.z
        );
        target.visible = false;
        if (game.state === GAME_STATES.PLAYING) {
            hitbox.getCenter(targetRing.position);
            targetRing.lookAt(playerAnchor);
            targetRing.visible = true;
        } else {
            targetRing.visible = false;
        }
    } else if (game.mode !== 'MULTI' && assets?.dummy) {
        target.position.y = playerAnchor.y;
        placeDummy(assets.dummy, target.position, playerAnchor);
        target.position.y += 0.35;
        assets.dummy.updateMatrixWorld(true);
        updateHitbox(hitbox, assets.dummy);
        assets.dummy.visible = game.state === GAME_STATES.PLAYING;
        if (game.mode === 'SINGLE' && assets.dummy.visible) {
            hitbox.getCenter(targetRing.position);
            targetRing.lookAt(playerAnchor);
            targetRing.visible = true;
        } else {
            targetRing.visible = false;
        }
        if (assets.opponent) assets.opponent.visible = false;
    } else if (game.mode === 'MULTI' && assets?.dummy) {
        placeDummy(assets.dummy, target.position, playerAnchor);
        assets.dummy.updateMatrixWorld(true);
        updateHitbox(hitbox, assets.dummy);
        assets.dummy.visible = game.state === GAME_STATES.PLAYING;
        targetRing.visible = false;
    }

    if (game.state === GAME_STATES.PLAYING) {
        if (!game.desktopActive) {
            detectPunch(controllers.left, 'left', delta, game);
            detectPunch(controllers.right, 'right', delta, game);
        }
        updateTimer(delta, game);
        controllers.leftFist.scale.setScalar(THREE.MathUtils.damp(controllers.leftFist.scale.x, 1, 16, delta));
        controllers.rightFist.scale.setScalar(THREE.MathUtils.damp(controllers.rightFist.scale.x, 1, 16, delta));
    }

    hud.update(game);
    hud.updateLoading(delta);
    combatFeedback.update(delta);
    updateTargetFlash(delta);
    gameOver.update();
    hud.updateTransform(game);
    hud.updateCountdownTransform(game.mode === 'MULTI');
    renderer.render(scene, camera);
});

function setPlayerSpawn() {
    const multiplayerMode = game.mode === 'MULTI';
    const secondPlayer = multiplayerMode && game.playerNumber === 2;
    playerRoot.position.set(0, 0, multiplayerMode ? secondPlayer ? -0.9 : 0.9 : 0);
    playerRoot.rotation.set(0, secondPlayer ? Math.PI : 0, 0);
    arenaAnchor.set(0, 0, 0);
    playerRoot.updateMatrixWorld(true);
    camera.getWorldPosition(playerAnchor);
    if (multiplayerMode) setOpponentSpawn();
}

function setOpponentSpawn() {
    const secondPlayer = game.playerNumber === 2;
    game.opponentPlayer.position.set(0, 0, secondPlayer ? 0.9 : -0.9);
    game.opponentPlayer.networkPosition.copy(game.opponentPlayer.position);
    game.opponentPlayer.rotation.set(0, secondPlayer ? 0 : Math.PI, 0);
    game.opponentPlayer.networkRotation.copy(game.opponentPlayer.rotation);
}

function getPlayerFacingRotation() {
    // The joystick rotates playerRoot through the full 360 degrees. Network
    // that yaw directly so the opponent model follows the same turn direction.
    return { x: 0, y: playerRoot.rotation.y, z: 0 };
}

function playOpponentAction(action, actionId) {
    game.opponentPlayer.action = action;
    game.opponentPlayer.actionId = actionId;
    game.opponentPlayer.actionStarted = performance.now();
    game.opponentPlayer.actionUntil = game.opponentPlayer.actionStarted + 650;
    game.opponentPlayer.animationActionId = '';
    dispatchOpponentAction();
}

function dispatchOpponentAction() {
    const controller = assets?.opponentAnimationController;
    const actionId = game.opponentPlayer.actionId;
    if (!controller || !game.opponentPlayer.action || game.opponentPlayer.animationActionId === actionId) return;

    const methods = {
        LEFT_PUNCH: 'playLeftPunch',
        RIGHT_PUNCH: 'playRightPunch',
        HIT_REACTION: 'playHitReaction',
        VICTORY: 'playVictory',
        DEFEAT: 'playDefeat'
    };
    const method = methods[game.opponentPlayer.action];
    if (!method) return;
    console.info(`[NETWORK] ${game.opponentPlayer.action}`);
    controller[method]();
    game.opponentPlayer.animationActionId = actionId;
}

function updateTargetFlash(delta) {
    if (!(game.targetFlashTimer > 0)) return;
    game.targetFlashTimer = Math.max(0, game.targetFlashTimer - delta);
    const progress = 1 - game.targetFlashTimer / game.targetFlashDuration;
    const pulse = Math.sin(progress * Math.PI);
    const strength = game.targetFlashStrength || 1;
    target.scale.setScalar(1 + pulse * 0.08 * strength);
    targetRing.scale.setScalar(1 + pulse * 0.14 * strength);
    targetRing.material.opacity = 0.78 + (1 - progress) * 0.22;
    if (game.targetFlashTimer <= 0) game.resetTargetEffects();
}







