import * as THREE from 'three';

export function initScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 0);
    const playerRoot = new THREE.Group();
    playerRoot.name = 'LocalPlayerRoot';
    playerRoot.add(camera);
    scene.add(playerRoot);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor, new THREE.GridHelper(10, 10));

    const playerMarker = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.31, 48),
        new THREE.MeshBasicMaterial({ color: 0x666666, side: THREE.DoubleSide })
    );
    playerMarker.rotation.x = -Math.PI / 2;
    playerMarker.position.y = 0.01;
    scene.add(playerMarker);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer, playerMarker, playerRoot };
}
