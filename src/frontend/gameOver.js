import * as THREE from 'three';

function createPanelText() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.88, 0.44),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    mesh.position.set(0, 0.19, 0.02);
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    mesh.userData.draw = summary => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#101c2a');
        gradient.addColorStop(1, '#07111c');
        context.fillStyle = gradient;
        context.beginPath();
        context.roundRect(18, 14, 988, 484, 30);
        context.fill();
        context.strokeStyle = '#8da4b8';
        context.lineWidth = 4;
        context.stroke();
        context.fillStyle = '#c8f36a';
        context.fillRect(38, 48, 8, 416);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = 'rgba(0,0,0,0.85)';
        context.shadowBlur = 10;

        if (summary.mode === 'MULTI') {
            const result = summary.matchResult || 'MATCH COMPLETE';
            context.fillStyle = '#d6e2ed';
            context.font = '800 30px Arial';
            context.fillText('MULTIPLAYER  /  FINAL RESULT', 522, 62);
            context.fillStyle = result === 'YOU WIN' ? '#c8f36a' : result === 'YOU LOSE' ? '#ff7185' : '#ffd166';
            context.font = '900 68px Arial';
            context.fillText(result, 522, 134);

            const players = summary.matchScores.length === 2
                ? summary.matchScores
                : [
                    { playerNumber: 1, score: summary.playerNumber === 1 ? summary.score : 0 },
                    { playerNumber: 2, score: summary.playerNumber === 2 ? summary.score : 0 }
                ];
            for (let index = 0; index < players.length; index++) {
                const player = players[index];
                const isLocal = player.playerNumber === summary.playerNumber;
                const centerX = index === 0 ? 300 : 736;
                context.fillStyle = isLocal ? '#263b30' : '#1b2b3b';
                context.beginPath();
                context.roundRect(centerX - 184, 184, 368, 106, 18);
                context.fill();
                context.strokeStyle = isLocal ? '#c8f36a' : '#657d91';
                context.lineWidth = 3;
                context.stroke();
                context.fillStyle = isLocal ? '#c8f36a' : '#d6e2ed';
                context.font = '800 25px Arial';
                context.fillText(`PLAYER ${player.playerNumber}${isLocal ? '  /  YOU' : ''}`, centerX, 213);
                context.fillStyle = '#ffffff';
                context.font = '900 48px Arial';
                context.fillText(`${player.hp ?? 0} HP`, centerX, 260);
            }
            context.fillStyle = '#d6e2ed';
            context.font = '800 27px Arial';
            context.fillText(`YOUR HP  ${summary.hp ?? 0}/${summary.startingHp ?? 20}     OPPONENT HP  ${summary.opponentHp ?? 0}/${summary.startingHp ?? 20}`, 522, 344);
            context.fillStyle = '#ffd166';
            context.font = '700 25px Arial';
            context.fillText(`HITS  ${summary.hits}     PERFECT  ${summary.perfects}`, 522, 403);
            texture.needsUpdate = true;
            return;
        }

        const modeTitles = {
            classic: 'CLASSIC  /  ROUND COMPLETE',
            reflex: 'REFLEX  /  REACTION ROUND',
            'combo-chain': 'COMBO CHAIN  /  CHAIN BROKEN',
            survival: 'SURVIVAL  /  RUN COMPLETE'
        };
        context.fillStyle = '#d6e2ed';
        context.font = '800 28px Arial';
        context.fillText(modeTitles[summary.currentMode] || 'SINGLEPLAYER  /  ROUND COMPLETE', 522, 61);
        context.fillStyle = '#ffffff';
        context.font = '900 86px Arial';

        if (summary.currentMode === 'survival') {
            context.fillStyle = '#ff8c9c';
            context.fillText(formatDuration(summary.elapsed), 522, 181);
            context.fillStyle = '#d6e2ed';
            context.font = '800 25px Arial';
            context.fillText('TIME SURVIVED', 522, 224);
        } else if (summary.currentMode === 'combo-chain') {
            context.fillStyle = '#ffd166';
            context.fillText(`x${summary.bestCombo}`, 522, 181);
            context.fillStyle = '#d6e2ed';
            context.font = '800 25px Arial';
            context.fillText('BEST CHAIN', 522, 224);
        } else {
            context.fillStyle = '#c8f36a';
            context.fillText(String(summary.score), 522, 181);
            context.fillStyle = '#d6e2ed';
            context.font = '800 25px Arial';
            context.fillText('POINTS', 522, 224);
        }

        context.fillStyle = '#8da4b8';
        context.fillRect(88, 270, 868, 2);
        const metrics = summary.currentMode === 'survival'
            ? [
                ['SCORE', summary.score],
                ['HITS', summary.hits],
                ['HP LEFT', `${summary.survivalHp}/3`]
            ]
            : summary.currentMode === 'combo-chain'
                ? [
                    ['SCORE', summary.score],
                    ['HITS', summary.hits],
                    ['PERFECT', summary.perfects]
                ]
                : [
                    ['HITS', summary.hits],
                    ['MISSES', summary.misses],
                    ['PERFECT', summary.perfects]
                ];
        for (let index = 0; index < metrics.length; index++) {
            const centerX = 224 + index * 298;
            context.fillStyle = '#a9bac9';
            context.font = '800 22px Arial';
            context.fillText(metrics[index][0], centerX, 328);
            context.fillStyle = '#ffffff';
            context.font = '900 39px Arial';
            context.fillText(String(metrics[index][1]), centerX, 375);
        }
        context.fillStyle = '#ffd166';
        context.font = '800 26px Arial';
        const footer = summary.currentMode === 'survival'
            ? `BEST COMBO  x${summary.bestCombo}     HP DEPLETED`
            : summary.currentMode === 'combo-chain'
                ? `CHAIN FAILED     BEST COMBO  x${summary.bestCombo}`
                : `BEST COMBO  x${summary.bestCombo}     BEST SCORE  ${summary.best}     ROUND ${summary.duration}s`;
        context.fillText(footer, 522, 440);
        texture.needsUpdate = true;
    };
    return mesh;
}

function formatDuration(seconds = 0) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function initGameOver({ scene, camera, renderer, controllers, onPlayAgain = () => {}, onHome = () => {} }) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.00, 0.90),
        new THREE.MeshBasicMaterial({ color: 0x111521, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    const border = new THREE.Mesh(
        new THREE.PlaneGeometry(1.02, 0.92),
        new THREE.MeshBasicMaterial({ color: 0xe04b56, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    border.position.z = -0.002;
    border.renderOrder = 999;
    border.frustumCulled = false;
    panel.renderOrder = 1000;
    panel.frustumCulled = false;
    const panelText = createPanelText();
    panelText.renderOrder = 1001;
    group.add(border, panel, panelText);
    group.scale.setScalar(0.82);

    const buttons = [];
    let lastSummary = null;
    let introStartedAt = 0;
    const addButton = (label, y, action) => {
        const baseColor = 0x182943;
        const hoverColor = 0x00c896;
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.72, 0.13),
            new THREE.MeshBasicMaterial({ color: baseColor, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        );
        mesh.position.set(0, y, 0.05);
        mesh.renderOrder = 1002;
        mesh.frustumCulled = false;
        mesh.userData.action = action;
        mesh.userData.baseColor = baseColor;
        mesh.userData.hoverColor = hoverColor;
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.font = 'bold 54px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(label, 256, 64);
        const buttonTexture = new THREE.CanvasTexture(canvas);
        buttonTexture.colorSpace = THREE.SRGBColorSpace;
        const text = new THREE.Mesh(
            new THREE.PlaneGeometry(0.65, 0.10),
            new THREE.MeshBasicMaterial({ map: buttonTexture, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        );
        text.position.set(0, y, 0.075);
        text.renderOrder = 1003;
        text.frustumCulled = false;
        group.add(mesh, text);
        buttons.push(mesh);
    };
    addButton('PLAY AGAIN', -0.20, () => {
        group.visible = false;
        controllers.leftPointer.visible = false;
        controllers.rightPointer.visible = false;
        onPlayAgain();
    });
    addButton('HOME', -0.36, () => {
        controllers.leftPointer.visible = false;
        controllers.rightPointer.visible = false;
        onHome();
    });

    const raycaster = new THREE.Raycaster();
    raycaster.far = 2.0;
    const hoverOrigin = new THREE.Vector3();
    const hoverDirection = new THREE.Vector3();
    function updateHover() {
        if (group.visible && introStartedAt) {
            const introProgress = THREE.MathUtils.clamp((performance.now() - introStartedAt) / 240, 0, 1);
            group.scale.setScalar(THREE.MathUtils.lerp(0.72, 0.82, THREE.MathUtils.smoothstep(introProgress, 0, 1)));
            if (introProgress >= 1) introStartedAt = 0;
        }
        const hovered = new Set();
        if (group.visible && renderer.xr.isPresenting) {
            for (const controller of [controllers.left, controllers.right]) {
                controller.updateMatrixWorld(true);
                hoverOrigin.setFromMatrixPosition(controller.matrixWorld);
                hoverDirection.set(0, 0, -1).transformDirection(controller.matrixWorld);
                raycaster.set(hoverOrigin, hoverDirection);
                const hit = raycaster.intersectObjects(buttons, false)[0];
                if (hit) hovered.add(hit.object);
            }
        }
        for (const button of buttons) {
            const isHovered = hovered.has(button);
            button.material.color.setHex(isHovered ? button.userData.hoverColor : button.userData.baseColor);
            button.material.opacity = isHovered ? 1 : 0.94;
            button.scale.setScalar(isHovered ? 1.04 : 1);
        }
    }
    for (const controller of [controllers.left, controllers.right]) {
        controller.addEventListener('selectstart', () => {
            if (!group.visible || !renderer.xr.isPresenting) return;
            controller.updateMatrixWorld(true);
            const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
            const direction = new THREE.Vector3(0, 0, -1).transformDirection(controller.matrixWorld);
            raycaster.set(origin, direction);
            const [hit] = raycaster.intersectObjects(buttons, false);
            if (hit) hit.object.userData.action();
        });
    }

    return {
        show(score, hits = 0, misses = 0, perfects = 0, bestCombo = 0, mode = 'SINGLE', playerNumber = 1, modeDetails = {}) {
            const previousBest = Number(localStorage.getItem('vr-boxing-best-score') || 0);
            if (mode === 'SINGLE' && score > previousBest) {
                localStorage.setItem('vr-boxing-best-score', String(score));
            }
            const best = mode === 'SINGLE' ? Math.max(score, previousBest) : score;
            lastSummary = {
                score, hits, misses, perfects, bestCombo, best, mode, playerNumber,
                currentMode: 'classic',
                elapsed: 0,
                duration: 0,
                survivalHp: 0,
                hp: 20,
                opponentHp: 20,
                startingHp: 20,
                matchResult: '',
                matchScores: [],
                ...modeDetails
            };
            const text = group.children.find(child => child.userData.draw);
            if (text) text.userData.draw(lastSummary);
            if (renderer.xr.isPresenting) {
                const xrCamera = renderer.xr.getCamera(camera);
                const position = new THREE.Vector3();
                const direction = new THREE.Vector3();
                xrCamera.getWorldPosition(position);
                xrCamera.getWorldDirection(direction);
                if (direction.lengthSq() < 0.0001) direction.set(0, 0, -1);
                direction.normalize();
                group.position.copy(position).add(direction.multiplyScalar(1.10));
                group.position.y = 1.60;
                group.lookAt(position.x, group.position.y, position.z);
            } else {
                const position = new THREE.Vector3();
                const direction = new THREE.Vector3();
                camera.getWorldPosition(position);
                camera.getWorldDirection(direction);
                group.position.copy(position).add(direction.multiplyScalar(1.10));
                group.position.y = position.y;
                group.lookAt(position.x, group.position.y, position.z);
            }
            group.visible = true;
            group.scale.setScalar(0.72);
            introStartedAt = performance.now();
            controllers.leftPointer.visible = true;
            controllers.rightPointer.visible = true;
            updateHover();
        },
        setMatchResult(result, scores = []) {
            if (!lastSummary) return;
            lastSummary.matchResult = result;
            lastSummary.matchScores = scores;
            const text = group.children.find(child => child.userData.draw);
            if (text) text.userData.draw(lastSummary);
        },
        update: updateHover,
        hide() {
            group.visible = false;
            controllers.leftPointer.visible = false;
            controllers.rightPointer.visible = false;
            updateHover();
        }
    };
}

