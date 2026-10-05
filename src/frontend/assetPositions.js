// Guru menyiapkan transform model di satu tempat agar siswa tidak perlu
// mengatur posisi, skala, dan rotasi aset.
import * as THREE from 'three';

export function placeGym(model) {
    model.scale.setScalar(1.0);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const floor = bounds.min.y;
    model.position.x -= center.x;
    model.position.y -= floor;
    model.position.y += 0.03;
    model.position.z -= center.z;
}

export function placeRing(model) {
    model.scale.setScalar(0.757);
    model.position.set(0, -0.50, 0);
}

export function placeDummy(model, targetPosition, playerPosition) {
    model.position.copy(targetPosition);
    model.position.y -= 1.50;
    model.position.y += 0.05;
    const dx = playerPosition.x - model.position.x;
    const dz = playerPosition.z - model.position.z;
    model.rotation.set(0, Math.atan2(dx, dz), 0);
}

export function placeOpponent(model, position, rotation, yawOffset = Math.PI / 2) {
    model.position.set(position.x, position.y - (model.userData.floorOffset || 0) + 0.05, position.z);
    model.rotation.set(rotation.x, rotation.y + yawOffset, rotation.z);
}

export function placeGlove(root, hand) {
    if (hand === 'left') {
        root.scale.setScalar(0.016);
        root.rotation.set(-Math.PI / 2, 0, 0);
        root.position.set(0, 0, -0.08);
    } else {
        root.scale.setScalar(0.60);
        root.rotation.set(-Math.PI / 2, Math.PI / 2, 0);
        root.position.set(0.05, -0.13, -0.05);
    }
}
