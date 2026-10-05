import * as THREE from 'three';

const DEAD_ZONE = 0.16;
const WALK_SPEED = 1.65;
const RUN_SPEED = 3.1;
const MAX_OFFSET = 2.4;
const TURN_SPEED = 1.8;

export function updateVRLocomotion(renderer, delta, game) {
    const session = renderer.xr.getSession();
    if (!session || !game.playerRoot) return;
    const canMove = game.mode === 'MULTI' && game.state === 'PLAYING';
    if (!canMove) {
        game.movementState = 'IDLE';
        return;
    }

    const sources = Array.from(session.inputSources);
    const leftSource = sources.find(item => item.handedness === 'left' && item.gamepad) ||
        sources.find(item => item.gamepad);
    if (!leftSource) return;

    const axes = leftSource.gamepad.axes;
    const axisOffset = axes.length >= 4 ? 2 : 0;
    let sideInput = applyDeadZone(axes[axisOffset] || 0);
    let forwardInput = -applyDeadZone(axes[axisOffset + 1] || 0);
    const inputLength = Math.hypot(sideInput, forwardInput);
    if (inputLength > 1) {
        sideInput /= inputLength;
        forwardInput /= inputLength;
    }

    const rightSource = sources.find(item => item.handedness === 'right' && item.gamepad);
    if (rightSource) {
        const turnOffset = rightSource.gamepad.axes.length >= 4 ? 2 : 0;
        const turnInput = applyDeadZone(rightSource.gamepad.axes[turnOffset] || 0);
        game.playerRoot.rotation.y -= turnInput * TURN_SPEED * delta;
    }

    const playerRoot = game.playerRoot;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerRoot.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerRoot.quaternion);
    const movement = new THREE.Vector3()
        .addScaledVector(forward, forwardInput)
        .addScaledVector(right, sideInput);
    const speed = leftSource.gamepad.buttons[3]?.pressed ? RUN_SPEED : WALK_SPEED;
    playerRoot.position.addScaledVector(movement, speed * delta);
    playerRoot.position.x = THREE.MathUtils.clamp(playerRoot.position.x, -MAX_OFFSET, MAX_OFFSET);
    playerRoot.position.z = THREE.MathUtils.clamp(playerRoot.position.z, -MAX_OFFSET, MAX_OFFSET);
    game.movementState = movement.lengthSq() > 0.001
        ? speed === RUN_SPEED ? 'RUN' : 'WALK'
        : 'IDLE';
}

function applyDeadZone(value) {
    if (Math.abs(value) <= DEAD_ZONE) return 0;
    return Math.sign(value) * (Math.abs(value) - DEAD_ZONE) / (1 - DEAD_ZONE);
}
