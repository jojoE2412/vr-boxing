import * as THREE from 'three';

export function createHitbox() {
    return new THREE.Box3();
}

export function updateHitbox(hitbox, dummy) {
    if (dummy) hitbox.setFromObject(dummy);
    return hitbox;
}

export function getTargetHitbox(hitbox) {
    return hitbox;
}
