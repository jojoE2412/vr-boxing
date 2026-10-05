import * as THREE from 'three';

const COLORS = {
    hit: '#83f0bb',
    combo: '#ffd166',
    miss: '#ff7185',
    perfect: '#fff28a',
    hp: '#ff8c9c',
    failed: '#ff596e'
};
const PRIORITY = { hit: 1, miss: 2, combo: 3, hp: 4, perfect: 5, failed: 6 };

export function initCombatFeedback(scene, camera, renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 320;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.17), material);
    mesh.renderOrder = 1200;
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.visible = false;
    group.add(mesh);
    scene.add(group);

    const queue = [];
    const cameraPosition = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    const anchorPosition = new THREE.Vector3();
    const anchorSize = new THREE.Vector3();
    const towardCamera = new THREE.Vector3();
    const anchorBounds = new THREE.Box3();
    let active = null;
    let elapsed = 0;

    function draw(item) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = COLORS[item.kind] || '#ffffff';
        context.shadowColor = context.fillStyle;
        context.shadowBlur = item.kind === 'perfect' || item.kind === 'combo' ? 30 : 16;
        const lines = String(item.text).split('\n');
        const lineHeight = lines.length > 1 ? 118 : 170;
        context.font = `900 ${lines.length > 1 ? 112 : 148}px Arial`;
        lines.forEach((line, index) => {
            const y = canvas.height / 2 + (index - (lines.length - 1) / 2) * lineHeight;
            context.fillText(line, canvas.width / 2, y, canvas.width - 56);
        });
        context.shadowBlur = 0;
        texture.needsUpdate = true;
    }

    function beginNext() {
        active = queue.shift() || null;
        elapsed = 0;
        group.visible = Boolean(active);
        if (active) draw(active);
    }

    function show(text, kind = 'hit', anchor = null) {
        const item = { text, kind, anchor, duration: kind === 'combo' || kind === 'perfect' ? 1.0 : 0.78 };
        if (kind === 'perfect' || kind === 'failed') {
            queue.length = 0;
            active = item;
            elapsed = 0;
            group.visible = true;
            material.opacity = 0;
            draw(item);
        } else if (!active) {
            active = item;
            elapsed = 0;
            group.visible = true;
            draw(item);
        } else if (queue.length === 0) {
            queue.push(item);
        } else if (PRIORITY[item.kind] >= PRIORITY[queue[0].kind]) {
            queue[0] = item;
        }
    }

    return {
        show,
        update(delta) {
            if (!active) return;
            elapsed += delta;
            const progress = THREE.MathUtils.clamp(elapsed / active.duration, 0, 1);
            const fadeIn = THREE.MathUtils.smoothstep(elapsed, 0, 0.12);
            const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.68, 1);
            material.opacity = fadeIn * fadeOut;
            const entrance = THREE.MathUtils.smoothstep(elapsed, 0, 0.14);
            group.scale.setScalar(0.78 + entrance * 0.22 + Math.sin(progress * Math.PI) * 0.025);

            const viewCamera = renderer.xr.isPresenting ? renderer.xr.getCamera(camera) : camera;
            viewCamera.getWorldPosition(cameraPosition);
            viewCamera.getWorldDirection(cameraDirection);
            if (active.anchor?.isObject3D) {
                active.anchor.updateWorldMatrix(true, true);
                anchorBounds.setFromObject(active.anchor);
            }
            if (active.anchor?.isObject3D && !anchorBounds.isEmpty()) {
                anchorBounds.getCenter(anchorPosition);
                anchorBounds.getSize(anchorSize);
                anchorPosition.y += Math.max(0.18, anchorSize.y * 0.30);
                towardCamera.subVectors(cameraPosition, anchorPosition).normalize();
                group.position.copy(anchorPosition).addScaledVector(towardCamera, 0.08);
            } else {
                group.position.copy(cameraPosition).addScaledVector(cameraDirection, 0.72);
                group.position.y += 0.22;
            }
            group.quaternion.copy(viewCamera.quaternion);

            if (progress >= 1) beginNext();
        },
        reset() {
            queue.length = 0;
            active = null;
            elapsed = 0;
            group.visible = false;
            material.opacity = 0;
        }
    };
}