import * as THREE from 'three';

function createCard(root, width, height, x, y, color) {
    const card = new THREE.Group();
    card.position.set(x, y, 0);

    const background = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.60, side: THREE.DoubleSide })
    );
    background.position.z = 0.005;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    const text = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    text.position.z = 0.02;
    text.scale.set(width * 1.55, height * 0.72, 1);
    card.add(background, text);
    root.add(card);

    let previous = '';
    return (value, textColor = color) => {
        const key = value + textColor;
        if (previous === key) return;
        previous = key;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = textColor;
        context.font = 'bold 72px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(value, 512, 128);
        texture.needsUpdate = true;
    };
}

function createHealthBar(parent, label, fillColor = 0xe53935) {
    const group = new THREE.Group();
    const cells = [];
    const cellWidth = 0.034;
    const gap = 0.008;
    for (let index = 0; index < 20; index++) {
        const cell = new THREE.Mesh(
            new THREE.PlaneGeometry(cellWidth, 0.052),
            new THREE.MeshBasicMaterial({ color: fillColor, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        );
        cell.position.x = (index - 9.5) * (cellWidth + gap);
        cell.renderOrder = 1180;
        group.add(cell);
        cells.push(cell);
    }
    const setLabel = createCard(group, 0.84, 0.075, 0, 0.09, '#ffffff');
    parent.add(group);

    return {
        group,
        update(name, hp, maxHp) {
            const currentHp = THREE.MathUtils.clamp(hp ?? maxHp, 0, cells.length);
            cells.forEach((cell, index) => {
                cell.material.color.setHex(index < currentHp ? fillColor : 0x101010);
            });
            setLabel(`${name}  ${currentHp}/${maxHp}`);
        }
    };
}

export function initHUD(scene, camera, renderer) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    const score = createCard(group, 0.42, 0.11, -0.58, 0.31, '#ffffff');
    const time = createCard(group, 0.42, 0.11, 0.58, 0.31, '#66ff66');
    const combo = createCard(group, 0.42, 0.11, -0.62, 0.14, '#ffcc66');
    const hits = createCard(group, 0.42, 0.11, 0.62, 0.14, '#ffffff');
    const leftSpeed = createCard(group, 0.52, 0.11, -0.55, -0.19, '#66aaff');
    const rightSpeed = createCard(group, 0.52, 0.11, 0.55, -0.19, '#ff7777');
    const status = createCard(group, 0.72, 0.10, 0, -0.35, '#aaaaaa');
    const opponentHealthBar = createHealthBar(scene, 'OPPONENT', 0xf04444);
    // This bar is camera-space UI: it stays just below the player's view and
    // follows head rotation instead of drifting toward the arena center.
    const localHealthBar = createHealthBar(camera, 'HP', 0x39d9a5);
    localHealthBar.group.position.set(0, -0.36, -0.78);
    localHealthBar.group.scale.setScalar(0.75);

    const countdownGroup = new THREE.Group();
    countdownGroup.visible = false;
    // Camera-space countdown: sits above the self health bar and turns with
    // the player's view while the round is starting.
    camera.add(countdownGroup);
    countdownGroup.position.set(0, 0.19, -0.85);
    countdownGroup.scale.setScalar(0.75);
    const countdownPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.50, 0.38),
        new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.84, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    countdownPanel.renderOrder = 1198;
    countdownGroup.add(countdownPanel);
    const countdownCanvas = document.createElement('canvas');
    countdownCanvas.width = 1024;
    countdownCanvas.height = 256;
    const countdownContext = countdownCanvas.getContext('2d');
    const countdownTexture = new THREE.CanvasTexture(countdownCanvas);
    countdownTexture.generateMipmaps = false;
    countdownTexture.minFilter = THREE.LinearFilter;
    const countdownText = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: countdownTexture, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    countdownText.renderOrder = 1199;
    countdownText.position.z = 0.03;
    countdownText.scale.set(0.44, 0.29, 1);
    countdownGroup.add(countdownText);

    const loadingGroup = new THREE.Group();
    loadingGroup.visible = false;
    loadingGroup.position.set(0, 0.19, -0.85);
    loadingGroup.scale.setScalar(0.75);
    camera.add(loadingGroup);
    const loadingPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.50, 0.38),
        new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.88, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    loadingPanel.renderOrder = 1198;
    loadingGroup.add(loadingPanel);
    const loadingCanvas = document.createElement('canvas');
    loadingCanvas.width = 1024;
    loadingCanvas.height = 256;
    const loadingContext = loadingCanvas.getContext('2d');
    const loadingTexture = new THREE.CanvasTexture(loadingCanvas);
    loadingTexture.generateMipmaps = false;
    loadingTexture.minFilter = THREE.LinearFilter;
    const loadingText = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: loadingTexture, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    loadingText.renderOrder = 1199;
    loadingText.position.z = 0.03;
    loadingText.scale.set(0.44, 0.29, 1);
    loadingGroup.add(loadingText);
    const loadingSpinner = new THREE.Mesh(
        new THREE.TorusGeometry(0.035, 0.009, 8, 28, Math.PI * 1.55),
        new THREE.MeshBasicMaterial({ color: 0x39d9a5, depthTest: false, depthWrite: false })
    );
    loadingSpinner.position.set(0, -0.105, 0.035);
    loadingSpinner.renderOrder = 1200;
    loadingGroup.add(loadingSpinner);

    const cameraPosition = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    const barPosition = new THREE.Vector3();
    const cameraQuaternion = new THREE.Quaternion();
    const rightEyePosition = new THREE.Vector3();
    let lastCountdownText = '';
    let loadingElapsed = 0;

    function drawLoadingText() {
        const dots = '.'.repeat(1 + Math.floor(loadingElapsed * 2) % 3);
        loadingContext.clearRect(0, 0, loadingCanvas.width, loadingCanvas.height);
        loadingContext.fillStyle = '#ffffff';
        loadingContext.font = 'bold 128px Arial';
        loadingContext.textAlign = 'center';
        loadingContext.textBaseline = 'middle';
        loadingContext.fillText(`LOADING${dots}`, 512, 128);
        loadingTexture.needsUpdate = true;
    }

    function updateViewPose() {
        const viewCamera = renderer.xr.isPresenting ? renderer.xr.getCamera(camera) : camera;
        viewCamera.updateMatrixWorld(true);
        if (renderer.xr.isPresenting && Array.isArray(viewCamera.cameras) && viewCamera.cameras.length > 0) {
            const eyes = viewCamera.cameras;
            eyes[0].updateMatrixWorld(true);
            eyes[0].getWorldPosition(cameraPosition);
            eyes[0].getWorldQuaternion(cameraQuaternion);
            if (eyes.length > 1) {
                eyes[1].updateMatrixWorld(true);
                eyes[1].getWorldPosition(rightEyePosition);
                cameraPosition.add(rightEyePosition).multiplyScalar(0.5);
            }
            cameraDirection.set(0, 0, -1).applyQuaternion(cameraQuaternion).normalize();
            return;
        }
        viewCamera.getWorldPosition(cameraPosition);
        viewCamera.getWorldDirection(cameraDirection);
        viewCamera.getWorldQuaternion(cameraQuaternion);
    }

    function setCountdownText(value, color = '#ffffff') {
        const key = value + color;
        if (key === lastCountdownText) return;
        lastCountdownText = key;
        countdownContext.clearRect(0, 0, countdownCanvas.width, countdownCanvas.height);
        countdownContext.fillStyle = color;
        countdownContext.font = 'bold 180px Arial';
        countdownContext.textAlign = 'center';
        countdownContext.textBaseline = 'middle';
        countdownContext.fillText(value, 512, 128);
        countdownTexture.needsUpdate = true;
    }

    return {
        // Keep the previous score/time/status HUD disabled.
        show() { group.visible = false; },
        showCountdown(visible) {
            countdownGroup.visible = visible;
            if (visible) loadingGroup.visible = false;
        },
        showLoading(visible) {
            loadingGroup.visible = visible;
            if (visible) {
                countdownGroup.visible = false;
                loadingElapsed = 0;
                drawLoadingText();
            }
        },
        updateLoading(delta) {
            if (!loadingGroup.visible) return;
            loadingElapsed += delta;
            loadingSpinner.rotation.z -= delta * 4.2;
            if (Math.floor(loadingElapsed * 2) !== Math.floor((loadingElapsed - delta) * 2)) drawLoadingText();
        },
        setCountdownText,
        update(game = {}) {
            const opponentNumber = game.playerNumber === 1 ? 2 : 1;
            score(game.mode === 'MULTI'
                ? `P${game.playerNumber || 1} ${game.score ?? 0} PTS`
                : `SCORE ${game.score ?? 0}`);
            time(game.mode === 'MULTI'
                ? `HP ${game.hp ?? 20}/${game.startingHp ?? 20}`
                : `TIME ${game.timeLeft ?? 0}`,
            game.mode === 'MULTI' ? (game.hp ?? 20) <= 5 ? '#ff5555' : '#66ff66'
                : (game.timeLeft ?? 0) <= 5 ? '#ff5555' : '#66ff66');
            combo(`COMBO x${game.combo ?? 0}`, (game.combo ?? 0) >= 3 ? '#ffcc66' : '#ffffff');
            hits(game.mode === 'MULTI'
                ? `P${opponentNumber} HP ${game.opponentHp ?? 20}/${game.startingHp ?? 20}`
                : `HIT ${game.hits ?? 0}  MISS ${game.misses ?? 0}`);
            leftSpeed(`LEFT ${(game.leftHandSpeed ?? 0).toFixed(1)} m/s`);
            rightSpeed(`RIGHT ${(game.rightHandSpeed ?? 0).toFixed(1)} m/s`);
            status(game.status || `DIFFICULTY ${game.difficulty || 'NORMAL'}`);
            opponentHealthBar.update(`P${opponentNumber}`, game.opponentHp, game.startingHp || 20);
            localHealthBar.update('HP', game.hp, game.startingHp || 20);
        },
        updateTransform(game = {}) {
            updateViewPose();
            const isMultiplayer = game.mode === 'MULTI';
            const inMatch = game.state === 'COUNTDOWN' || game.state === 'PLAYING';
            localHealthBar.group.visible = isMultiplayer && inMatch;
            const opponent = game.assets?.opponent;
            opponentHealthBar.group.visible = isMultiplayer && game.state === 'PLAYING' && Boolean(opponent?.visible);
            if (opponentHealthBar.group.visible) {
                opponent.getWorldPosition(barPosition);
                barPosition.y += 1.98;
                opponentHealthBar.group.position.copy(barPosition);
                opponentHealthBar.group.lookAt(cameraPosition);
            }
        },
        updateCountdownTransform(followView = false) {
            // Position is local to the camera, so the countdown remains fixed
            // above the player's view until showCountdown(false) hides it.
        }
    };
}

