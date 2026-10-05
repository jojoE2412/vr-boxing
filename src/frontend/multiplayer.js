export function createMultiplayerClient(onMessage = () => {}) {
    let socket = null;
    let connectionPromise = null;
    let actionId = 0;

    function connect() {
        if (socket?.readyState === WebSocket.OPEN) return Promise.resolve();
        if (connectionPromise) return connectionPromise;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${protocol}//${window.location.host}/multiplayer`);
        connectionPromise = new Promise((resolve, reject) => {
            socket.addEventListener('open', () => {
                connectionPromise = null;
                resolve();
            }, { once: true });
            socket.addEventListener('message', event => {
                try {
                    onMessage(JSON.parse(event.data));
                } catch (error) {
                    console.error('[MULTIPLAYER] Invalid server message:', error);
                }
            });
            socket.addEventListener('error', () => {
                connectionPromise = null;
                reject(new Error('Tidak dapat terhubung ke server multiplayer.'));
            }, { once: true });
            socket.addEventListener('close', () => {
                connectionPromise = null;
                onMessage({ type: 'disconnected' });
            });
        });
        return connectionPromise;
    }

    async function send(type, payload = {}) {
        await connect();
        if (socket?.readyState !== WebSocket.OPEN) throw new Error('Koneksi multiplayer terputus.');
        socket.send(JSON.stringify({ type, ...payload }));
    }

    return {
        createRoom(settings) { return send('create-room', { settings }); },
        joinRoom(roomCode) { return send('join-room', { roomCode }); },
        setReady() { return send('ready'); },
        startMatch() { return send('start-match'); },
        cancelReady() { return send('cancel-ready'); },
        sendPlayerState(state) { return send('player-state', state); },
        sendAction(action) { return send('player-action', { action, actionId: ++actionId }); },
        sendPunchResult(hand, result) { return send('player-result', { hand, result }); },
        sendScore(score, timeLeft) { return send('score', { score, timeLeft }); },
        finish(playerState) {
            const state = typeof playerState === 'number' ? { score: playerState } : playerState;
            return send('finish', state);
        },
        async leaveRoom() {
            if (socket?.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'leave-room' }));
            }
        }
    };
}