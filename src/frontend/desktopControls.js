import * as THREE from 'three';

export const PC_CONTROL_ENABLED = true;

export function initDesktopControls({ camera, canvas, playerRoot, onExit = () => {}, onPlayAgain = () => {} }) {
    const keys = new Set();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const movement = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    let active = false;
    let movementState = 'IDLE';
    let movementEnabled = true;

    function requestPointerLock() {
        if (!active || !canvas?.requestPointerLock || document.pointerLockElement === canvas) return;
        canvas.requestPointerLock().catch(() => {});
    }

    function onMouseMove(event) {
        if (!active || document.pointerLockElement !== canvas) return;
        playerRoot.rotation.y -= event.movementX * 0.0025;
        camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - event.movementY * 0.0025, -1.1, 1.1);
    }

    function onKeyDown(event) {
        if (!active) return;
        if (event.code === 'Escape') {
            onExit();
            return;
        }
        if (event.code === 'Enter' && !event.repeat) {
            onPlayAgain();
            return;
        }
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
            event.preventDefault();
        }
        keys.add(event.code);
    }

    function onKeyUp(event) {
        keys.delete(event.code);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas?.addEventListener('click', requestPointerLock);

    function update(delta, allowMovement = movementEnabled) {
        if (!active) return;

        if (allowMovement) {
            forward.set(0, 0, -1).applyQuaternion(playerRoot.quaternion);
            right.set(1, 0, 0).applyQuaternion(playerRoot.quaternion);
            const forwardInput = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
            const sideInput = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
            movement.copy(forward).multiplyScalar(forwardInput).addScaledVector(right, sideInput);
            if (movement.lengthSq() > 1) movement.normalize();
            const desiredVelocity = movement.multiplyScalar(1.7);
            velocity.lerp(desiredVelocity, 1 - Math.exp(-12 * delta));
            playerRoot.position.addScaledVector(velocity, delta);
            playerRoot.position.x = THREE.MathUtils.clamp(playerRoot.position.x, -2.4, 2.4);
            playerRoot.position.z = THREE.MathUtils.clamp(playerRoot.position.z, -2.4, 2.4);
            if (velocity.lengthSq() > 0.01) {
                movementState = 'WALK';
            } else {
                movementState = 'IDLE';
            }
        } else {
            velocity.set(0, 0, 0);
            movementState = 'IDLE';
        }

    }

    return {
        start() {
            active = true;
            keys.clear();
            velocity.set(0, 0, 0);
            movementState = 'IDLE';
            camera.rotation.set(0, 0, 0);
            update(0.001, true);
            requestPointerLock();
        },
        stop() {
            active = false;
            keys.clear();
            velocity.set(0, 0, 0);
            movementState = 'IDLE';
            if (document.pointerLockElement === canvas) document.exitPointerLock();
        },
        setMovementEnabled(enabled) {
            movementEnabled = Boolean(enabled);
            if (!movementEnabled) {
                velocity.set(0, 0, 0);
                movementState = 'IDLE';
            }
        },
        update(delta, allowMovement = movementEnabled) {
            return update(delta, allowMovement);
        },
        get active() { return active; },
        get movementState() { return movementState; }
    };
}