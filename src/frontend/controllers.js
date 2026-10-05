import * as THREE from 'three';

export function initControllers(renderer, playerRoot) {
    const left = renderer.xr.getController(0);
    const right = renderer.xr.getController(1);
    playerRoot.add(left, right);

    const fistGeometry = new THREE.SphereGeometry(0.14, 24, 24);
    const leftFist = new THREE.Mesh(fistGeometry, new THREE.MeshStandardMaterial({ color: 0x4488ff }));
    const rightFist = new THREE.Mesh(fistGeometry, new THREE.MeshStandardMaterial({ color: 0xff4444 }));
    left.add(leftFist);
    right.add(rightFist);

    const pointerGeometry = new THREE.CylinderGeometry(0.005, 0.005, 1.35, 10);
    const leftPointer = new THREE.Mesh(pointerGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const rightPointer = new THREE.Mesh(pointerGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    for (const pointer of [leftPointer, rightPointer]) {
        pointer.rotation.x = Math.PI / 2;
        pointer.position.z = -0.675;
        pointer.visible = false;
    }
    left.add(leftPointer);
    right.add(rightPointer);

    return {
        left, right, leftFist, rightFist, leftPointer, rightPointer,
        previousLeftPosition: new THREE.Vector3(),
        previousRightPosition: new THREE.Vector3()
    };
}
