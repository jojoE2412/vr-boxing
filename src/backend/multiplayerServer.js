import { WebSocket, WebSocketServer } from 'ws';

export function multiplayerServerPlugin() {
    const attachServer = server => {
        const webSocketServer = new WebSocketServer({ noServer: true });
        const rooms = new Map();
        const clients = new Map();

        const send = (socket, message) => {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
        };
        const members = room => room.players.filter(Boolean);
        const broadcast = (room, message) => {
            for (const player of members(room)) send(player.socket, message);
        };
        const publishRoomState = room => {
            for (const player of members(room)) {
                send(player.socket, {
                    type: 'room-state',
                    roomCode: room.code,
                    playerNumber: player.number,
                    players: members(room).length,
                    ready: player.ready,
                    readyPlayers: members(room).filter(member => member.ready).length,
                    playerTwoReady: Boolean(room.players[1]?.ready),
                    settings: room.settings
                });
            }
        };
        const cleanVector = (value, limit = 5) => ({
            x: clampNumber(value?.x, -limit, limit),
            y: clampNumber(value?.y, -limit, limit),
            z: clampNumber(value?.z, -limit, limit)
        });
        const cleanControllerPose = pose => {
            const position = cleanVector(pose?.position, 2.5);
            const rotation = {
                x: clampNumber(pose?.rotation?.x, -1, 1),
                y: clampNumber(pose?.rotation?.y, -1, 1),
                z: clampNumber(pose?.rotation?.z, -1, 1),
                w: clampNumber(pose?.rotation?.w, -1, 1)
            };
            const length = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w);
            if (length > 1e-6) {
                rotation.x /= length;
                rotation.y /= length;
                rotation.z /= length;
                rotation.w /= length;
            } else {
                rotation.w = 1;
            }
            return { position, rotation };
        };
        const publishPlayerState = (room, player, message) => {
            player.position = cleanVector(message.position);
            player.rotation = cleanVector(message.rotation, Math.PI * 2);
            player.hands = {
                left: cleanControllerPose(message.hands?.left),
                right: cleanControllerPose(message.hands?.right)
            };
            player.movementState = ['IDLE', 'WALK', 'RUN'].includes(message.movementState)
                ? message.movementState
                : 'IDLE';
            player.score = clampNumber(message.score, 0, 1000000);
            player.combo = clampNumber(message.combo, 0, 100000);
            player.hits = clampNumber(message.hits, 0, 1000000);
            player.misses = clampNumber(message.misses, 0, 1000000);
            for (const other of members(room)) {
                if (other === player) continue;
                send(other.socket, {
                    type: 'opponent-state',
                    playerNumber: player.number,
                    position: player.position,
                    rotation: player.rotation,
                    hands: player.hands,
                    movementState: player.movementState,
                    score: player.score,
                    combo: player.combo,
                    hits: player.hits,
                    misses: player.misses,
                    hp: player.hp,
                    timeLeft: 0
                });
            }
        };
        const detach = socket => {
            const membership = clients.get(socket);
            if (!membership) return;
            const { room, player } = membership;
            room.players[player.number - 1] = null;
            room.inMatch = false;
            clients.delete(socket);
            for (const other of members(room)) {
                other.ready = false;
                other.finished = false;
                other.score = 0;
            }
            if (members(room).length === 0) {
                rooms.delete(room.code);
                return;
            }
            broadcast(room, { type: 'opponent-disconnected' });
            publishRoomState(room);
        };
        const createRoom = (socket, requestedSettings = {}) => {
            detach(socket);
            let code;
            do {
                code = Math.random().toString(36).slice(2, 7).toUpperCase();
            } while (code.length < 5 || rooms.has(code));
            const settings = {
                difficulty: ['EASY', 'NORMAL', 'HARD'].includes(requestedSettings.difficulty)
                    ? requestedSettings.difficulty
                    : 'NORMAL',
                duration: [30, 60].includes(Number(requestedSettings.duration))
                    ? Number(requestedSettings.duration)
                    : 30
            };
            const room = { code, players: [null, null], settings, inMatch: false };
            const player = createPlayer(socket, 1);
            room.players[0] = player;
            rooms.set(code, room);
            clients.set(socket, { room, player });
            publishRoomState(room);
        };
        const joinRoom = (socket, roomCode) => {
            const room = rooms.get(String(roomCode || '').trim().toUpperCase());
            if (!room) {
                send(socket, { type: 'room-error', message: 'Room tidak ditemukan.' });
                return;
            }
            const slot = room.players.findIndex(player => player === null);
            if (slot < 0) {
                send(socket, { type: 'room-error', message: 'Room sudah penuh.' });
                return;
            }
            detach(socket);
            const player = createPlayer(socket, slot + 1);
            room.players[slot] = player;
            clients.set(socket, { room, player });
            publishRoomState(room);
        };

        server.httpServer?.on('upgrade', (request, socket, head) => {
            const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
            if (pathname !== '/multiplayer') return;
            webSocketServer.handleUpgrade(request, socket, head, webSocket => {
                webSocketServer.emit('connection', webSocket, request);
            });
        });

        webSocketServer.on('connection', socket => {
            socket.on('message', raw => {
                let message;
                try {
                    message = JSON.parse(raw.toString());
                } catch {
                    send(socket, { type: 'room-error', message: 'Pesan multiplayer tidak valid.' });
                    return;
                }

                if (message.type === 'create-room') {
                    createRoom(socket, message.settings);
                    return;
                }
                if (message.type === 'join-room') {
                    joinRoom(socket, message.roomCode);
                    return;
                }
                if (message.type === 'leave-room') {
                    detach(socket);
                    return;
                }

                const membership = clients.get(socket);
                if (!membership) return;
                const { room, player } = membership;
                if (message.type === 'ready' || message.type === 'cancel-ready') {
                    player.ready = message.type === 'ready';
                    publishRoomState(room);
                    return;
                }
                if (message.type === 'start-match') {
                    const players = members(room);
                    if (player.number !== 1) {
                        send(socket, { type: 'room-error', message: 'Only the host can start the match.' });
                        return;
                    }
                    if (players.length !== 2 || !players.every(member => member.ready)) {
                        send(socket, { type: 'room-error', message: 'Both players must be ready before the match starts.' });
                        return;
                    }
                    for (const member of players) {
                        member.ready = false;
                        member.finished = false;
                        member.score = 0;
                        member.combo = 0;
                        member.hits = 0;
                        member.misses = 0;
                        member.hp = MULTIPLAYER_STARTING_HP;
                    }
                    room.inMatch = true;
                    room.roundNumber = (room.roundNumber || 0) + 1;
                    publishRoomState(room);
                    broadcast(room, {
                        type: 'start',
                        roundNumber: room.roundNumber,
                        startingHp: MULTIPLAYER_STARTING_HP,
                        startInMs: 8000
                    });
                    return;
                }
                if (message.type === 'score') {
                    player.score = Math.max(0, Number(message.score) || 0);
                    for (const other of members(room)) {
                        if (other !== player) send(other.socket, {
                            type: 'opponent-score',
                            score: player.score
                        });
                    }
                    return;
                }
                if (message.type === 'player-state') {
                    publishPlayerState(room, player, message);
                    return;
                }
                if (message.type === 'player-action') {
                    if (!['LEFT_PUNCH', 'RIGHT_PUNCH'].includes(message.action)) return;
                    console.info(`[NETWORK] ${message.action}`);
                    for (const other of members(room)) {
                        if (other !== player) send(other.socket, {
                            type: 'opponent-action',
                            playerNumber: player.number,
                            action: message.action,
                            actionId: String(message.actionId || '')
                        });
                    }
                    return;
                }
                if (message.type === 'player-result') {
                    if (!['left', 'right'].includes(message.hand)) return;
                    if (!['HIT', 'MISS', 'PERFECT'].includes(message.result)) return;
                    if (!room.inMatch) return;
                    console.info(`[NETWORK] ${message.result}`);
                    for (const other of members(room)) {
                        if (other === player) continue;
                        send(other.socket, {
                            type: 'opponent-result',
                            playerNumber: player.number,
                            hand: message.hand,
                            result: message.result
                        });
                        if (message.result !== 'MISS' && other.hp > 0) {
                            other.hp = Math.max(0, other.hp - (message.result === 'PERFECT' ? 2 : 1));
                        }
                    }
                    broadcast(room, {
                        type: 'health-state',
                        players: playersHealth(room)
                    });
                    const loser = members(room).find(member => member.hp <= 0);
                    if (loser) {
                        room.inMatch = false;
                        const winner = members(room).find(member => member !== loser);
                        broadcast(room, {
                            type: 'match-result',
                            winnerNumber: winner?.number || 0,
                            scores: members(room).map(member => ({
                                playerNumber: member.number,
                                score: member.score,
                                combo: member.combo,
                                hits: member.hits,
                                misses: member.misses,
                                hp: member.hp
                            }))
                        });
                    }
                    return;
                }
                if (message.type === 'finish') {
                    player.score = clampNumber(message.score, 0, 1000000);
                    player.combo = clampNumber(message.combo, 0, 100000);
                    player.hits = clampNumber(message.hits, 0, 1000000);
                    player.misses = clampNumber(message.misses, 0, 1000000);
                    player.finished = true;
                    const players = members(room);
                    if (players.length === 2 && players.every(member => member.finished)) {
                        const [first, second] = players;
                        const winnerNumber = first.score === second.score
                            ? 0
                            : first.score > second.score ? first.number : second.number;
                        broadcast(room, {
                            type: 'match-result',
                            winnerNumber,
                            scores: players.map(member => ({
                                playerNumber: member.number,
                                score: member.score,
                                combo: member.combo,
                                hits: member.hits,
                                misses: member.misses
                            }))
                        });
                    }
                }
            });
            socket.on('close', () => detach(socket));
        });
    };

    return {
        name: 'vr-boxing-multiplayer-server',
        configureServer: attachServer,
        configurePreviewServer: attachServer
    };
}

function clampNumber(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : 0;
}

const MULTIPLAYER_STARTING_HP = 20;

function playersHealth(room) {
    return room.players.filter(Boolean).map(player => ({
        playerNumber: player.number,
        hp: player.hp
    }));
}

function createPlayer(socket, number) {
    return {
        socket,
        number,
        ready: false,
        score: 0,
        combo: 0,
        hits: 0,
        misses: 0,
        hp: MULTIPLAYER_STARTING_HP,
        finished: false,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        hands: {
            left: cleanInitialHandPose(-0.22),
            right: cleanInitialHandPose(0.22)
        },
        movementState: 'IDLE'
    };
}

function cleanInitialHandPose(x) {
    return {
        position: { x, y: 1.2, z: -0.3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 }
    };
}
