import { enterVR } from './xr.js';

export function initUI({ renderer, audio, multiplayer, pcControlsEnabled = true, onDifficulty = () => {}, onDuration = () => {}, onMode = () => {}, onCurrentMode = () => {}, onStartKeyboard = () => {}, onLeaveRoom = () => {} }) {
    let difficulty = 'NORMAL';
    let duration = 30;
    let mode = 'SINGLE';
    let currentMode = 'classic';
    let roomCode = '';
    let roomReady = false;
    let playerNumber = 0;
    let readyPlayers = 0;
    let playerTwoReady = false;
    let localReady = false;
    let waitingForXRStart = false;
    const startScreen = document.getElementById('start-screen');
    const startBox = document.getElementById('start-box');
    const roomLobby = document.getElementById('room-lobby');
    const startButton = document.getElementById('start-button');
    const roomActionButton = document.getElementById('room-action-button');
    const roomStatus = document.getElementById('room-status');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const lobbyRoomCode = document.getElementById('lobby-room-code');
    const lobbyStatus = document.getElementById('lobby-status');
    const roomControls = document.getElementById('multiplayer-controls');
    const singleplayerModeControls = document.getElementById('singleplayer-mode-block');
    const roundTimeBlock = document.getElementById('round-time-block');
    const singleplayerModeButtons = document.querySelectorAll('.singleplayer-mode-button');

    function setRoomStatus(message) {
        roomStatus.textContent = message;
    }

    function updateStartButton() {
        const canReady = roomReady && playerNumber === 2 && !localReady;
        const canStart = roomReady && playerNumber === 1 && playerTwoReady;
        startButton.disabled = mode === 'MULTI' && !canReady && !canStart;
    }

    function updateRoundTimeVisibility() {
        const usesRoundTimer = mode !== 'MULTI' && (currentMode === 'classic' || currentMode === 'reflex');
        roundTimeBlock.hidden = !usesRoundTimer;
    }

    async function desktopFallbackAvailable() {
        if (!pcControlsEnabled) return false;
        // On standalone headsets a transient support-query failure must not silently
        // move the match into the flat browser controls.
        if (/Quest|OculusBrowser|PicoBrowser/i.test(navigator.userAgent)) return false;
        if (!navigator.xr?.isSessionSupported) return true;
        try {
            return !(await navigator.xr.isSessionSupported('immersive-vr'));
        } catch {
            return false;
        }
    }

    updateRoundTimeVisibility();

    function updateLobbyAction() {
        const canReady = roomReady && playerNumber === 2 && !localReady;
        const canStart = roomReady && playerNumber === 1 && playerTwoReady;
        roomActionButton.disabled = waitingForXRStart
            ? false
            : playerNumber === 1 ? !canStart : !canReady;
        roomActionButton.textContent = playerNumber === 1
            ? canStart ? 'START MATCH' : 'WAITING FOR PLAYER 2'
            : waitingForXRStart ? 'ENTER XR TO JOIN'
                : localReady ? 'READY - WAITING FOR HOST' : 'READY';
    }

    async function enterRoomAction() {
        if (roomActionButton.disabled) return;
        if (waitingForXRStart && playerNumber === 2) {
            audio.unlock().catch(error => console.warn('[AUDIO] Could not unlock audio:', error));
            try {
                await enterVR(renderer);
            } catch (error) {
                setRoomStatus(`Could not enter VR: ${error.message || 'WebXR session failed.'}`);
                window.alert(error.message || 'Could not enter VR.');
            }
            return;
        }
        if (playerNumber === 2 && !localReady) {
            try {
                await multiplayer.setReady();
                setRoomStatus('Ready. Stay in the room. Player 1 will start the match.');
            } catch (error) {
                setRoomStatus(error.message || 'Could not mark Player 2 ready.');
            }
            return;
        }
        audio.unlock().catch(error => console.warn('[AUDIO] Could not unlock audio:', error));
        if (playerNumber === 1) {
            try {
                await enterVR(renderer);
            } catch (error) {
                if (await desktopFallbackAvailable()) {
                    onStartKeyboard();
                    return;
                }
                setRoomStatus(`Could not enter VR: ${error.message || 'WebXR session failed.'}`);
                window.alert(error.message || 'Tidak dapat memulai VR.');
            }
        }
    }

    async function createRoom() {
        setRoomStatus('Connecting to multiplayer server...');
        try {
            await multiplayer.createRoom({ difficulty, duration });
        } catch (error) {
            setRoomStatus(error.message);
        }
    }

    async function joinRoom() {
        const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();
        if (roomCode.length !== 5) {
            setRoomStatus('Enter a 5-character room code.');
            return;
        }
        setRoomStatus('Joining room...');
        try {
            await multiplayer.joinRoom(roomCode);
        } catch (error) {
            setRoomStatus(error.message);
        }
    }

    document.querySelectorAll('.mode-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.mode-button').forEach(item => {
                item.classList.remove('selected');
                item.setAttribute('aria-pressed', 'false');
            });
            button.classList.add('selected');
            button.setAttribute('aria-pressed', 'true');
            const previousMode = mode;
            mode = button.dataset.mode;
            roomControls.hidden = mode !== 'MULTI';
            singleplayerModeControls.hidden = mode !== 'SINGLE';
            updateRoundTimeVisibility();
            updateStartButton();
            if (previousMode === 'MULTI' && mode === 'SINGLE') {
                multiplayer.leaveRoom();
                roomCode = '';
                roomReady = false;
                playerNumber = 0;
                readyPlayers = 0;
                localReady = false;
                roomCodeDisplay.textContent = '';
                document.querySelectorAll('.difficulty-button, .time-button').forEach(item => {
                    item.disabled = false;
                });
                setRoomStatus('Room left. Create a room or enter a room code.');
            }
            onMode(mode);
        });
    });

    singleplayerModeButtons.forEach(button => {
        button.addEventListener('click', () => {
            singleplayerModeButtons.forEach(item => {
                item.classList.toggle('selected', item === button);
                item.setAttribute('aria-pressed', String(item === button));
            });
            currentMode = button.dataset.currentMode;
            updateRoundTimeVisibility();
            onCurrentMode(currentMode);
        });
    });

    document.getElementById('create-room-button').addEventListener('click', createRoom);
    document.getElementById('join-room-button').addEventListener('click', joinRoom);
    roomActionButton.addEventListener('click', enterRoomAction);
    document.getElementById('leave-room-button').addEventListener('click', async () => {
        await multiplayer.leaveRoom();
        onLeaveRoom();
        roomCode = '';
        roomReady = false;
        playerNumber = 0;
        readyPlayers = 0;
        localReady = false;
        waitingForXRStart = false;
        startBox.hidden = false;
        roomLobby.hidden = true;
        roomCodeDisplay.textContent = '';
        lobbyRoomCode.textContent = '';
        document.querySelectorAll('.difficulty-button, .time-button').forEach(button => {
            button.disabled = false;
        });
        updateStartButton();
        lobbyStatus.textContent = 'Waiting for a player to join.';
        setRoomStatus('Room left. Create a room or enter a room code.');
        showStartScreen();
    });

    document.querySelectorAll('.difficulty-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.difficulty-button').forEach(item => item.classList.remove('selected'));
            button.classList.add('selected');
            difficulty = button.dataset.difficulty;
            onDifficulty(difficulty);
        });
    });

    document.querySelectorAll('.time-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.time-button').forEach(item => item.classList.remove('selected'));
            button.classList.add('selected');
            duration = Number(button.dataset.time);
            onDuration(duration);
        });
    });

    document.getElementById('start-button').addEventListener('click', async () => {
        if (mode === 'MULTI' && startButton.disabled) return;
        try {
            // Mulai audio tanpa menunggu download/decode selesai supaya
            // requestSession tetap berada pada aktivasi klik pengguna.
            audio.unlock().catch(error => console.warn('[AUDIO] Could not unlock audio:', error));
            await enterVR(renderer);
        } catch (error) {
            console.error('[XR] Could not start VR:', error);
            if (mode === 'MULTI' && await desktopFallbackAvailable()) {
                onStartKeyboard();
                return;
            }
            if (mode === 'MULTI') {
                setRoomStatus(`Could not enter VR: ${error.message || 'WebXR session failed.'}`);
            }
            window.alert(error.message || 'Tidak dapat memulai VR.');
        }
    });

    return {
        get settings() { return { difficulty, duration, mode }; },
        setRoomState(state) {
            waitingForXRStart = false;
            playerNumber = state.playerNumber || 0;
                roomCode = state.roomCode || '';
            readyPlayers = state.readyPlayers || 0;
            playerTwoReady = Boolean(state.playerTwoReady);
            localReady = Boolean(state.ready);
            roomReady = state.players === 2;
            const inRoom = Boolean(state.roomCode);
            startBox.hidden = inRoom;
            roomLobby.hidden = !inRoom;
            if (state.settings) {
                difficulty = state.settings.difficulty;
                duration = state.settings.duration;
                document.querySelectorAll('.difficulty-button').forEach(button => {
                    button.classList.toggle('selected', button.dataset.difficulty === difficulty);
                });
                document.querySelectorAll('.time-button').forEach(button => {
                    button.classList.toggle('selected', Number(button.dataset.time) === duration);
                });
            }
            document.querySelectorAll('.difficulty-button, .time-button').forEach(button => {
                button.disabled = Boolean(state.roomCode);
            });
            roomCodeDisplay.textContent = state.roomCode ? `ROOM CODE: ${state.roomCode}` : '';
            lobbyRoomCode.textContent = state.roomCode ? state.roomCode : '';
            document.getElementById('player-one-label').textContent = playerNumber === 1 ? 'YOU / HOST' : 'HOST';
            document.getElementById('player-one-status').textContent = 'IN ROOM';
            document.getElementById('player-two-status').textContent = roomReady
                ? (playerTwoReady ? 'READY' : 'CONNECTED')
                : 'WAITING';
            if (roomReady) {
                if (playerNumber === 1 && !playerTwoReady) {
                    setRoomStatus('PLAYER 2 CONNECTED. WAITING FOR PLAYER 2 TO PRESS PLAY.');
                } else if (playerNumber === 1 && readyPlayers > 0) {
                    setRoomStatus('PLAYER 2 READY. PRESS PLAY TO START.');
                } else if (localReady) {
                    setRoomStatus('READY. WAITING FOR PLAYER 1 TO START.');
                } else {
                    setRoomStatus('2 PLAYERS CONNECTED. PRESS PLAY WHEN READY.');
                }
            } else if (state.roomCode) {
                setRoomStatus('Waiting for player 2...');
            } else {
                setRoomStatus('Create a room or enter a room code.');
            }
            lobbyStatus.textContent = roomReady
                ? playerNumber === 1
                    ? playerTwoReady ? 'Player 2 is ready. Start the match when ready.' : 'Player 2 joined. Waiting for Player 2 to get ready.'
                    : localReady ? 'You are ready. Waiting for Player 1 to start.' : 'You joined. Press READY when you are set.'
                : 'Waiting for a player to join.';
            updateStartButton();
            updateLobbyAction();
        },
        setRoomStatus,
        promptXRJoin() {
            waitingForXRStart = true;
            updateLobbyAction();
            lobbyStatus.textContent = 'Player 1 started the match. Enter XR to join the countdown.';
            setRoomStatus('Match starting. Press ENTER XR TO JOIN on the headset.');
            showStartScreen();
        },
        showStartScreen() {
            startScreen.style.display = 'flex';
            startBox.hidden = Boolean(roomCode);
            roomLobby.hidden = !roomCode;
        },
        hideStartScreen() { startScreen.style.display = 'none'; }
    };
}
