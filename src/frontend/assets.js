import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import leftGloveUrl from '../assets/models/boxing_glove_left.glb?url';
import rightGloveUrl from '../assets/models/boxing_glove_right.glb?url';
import ringUrl from '../assets/models/boxing_ring.glb?url';
import dummyUrl from '../assets/models/training_dummy.glb?url';
import boxerUrl from '../assets/models/human_boxer.glb?url';
import gymUrl from '../assets/models/gym.glb?url';
import { placeGlove, placeGym, placeOpponent, placeRing } from './assetPositions.js';

const loader = new GLTFLoader();

function loadModel(url) {
    return new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
    });
}

export async function loadAssets(scene, controllers, target, playerAnchor) {
    const results = {};
    const loadAndAttach = async (key, url, setup) => {
        try {
            const gltf = await loadModel(url);
            const model = gltf.scene;
            setup(model, gltf);
            results[key] = model;
            if (gltf.animations.length) results[`${key}Animations`] = gltf.animations;
            console.log(`[A3D] ${key.toUpperCase()} LOADED`);
            return model;
        } catch (error) {
            console.error(`[A3D] ${key.toUpperCase()} LOAD ERROR`, error);
            results[key] = null;
            return null;
        }
    };

    await Promise.all([
        loadAndAttach('gym', gymUrl, model => { placeGym(model); scene.add(model); }),
        loadAndAttach('ring', ringUrl, model => { placeRing(model); scene.add(model); }),
        loadAndAttach('dummy', dummyUrl, model => {
            model.scale.setScalar(0.77);
            model.rotation.set(0, 0, 0);
            model.visible = false;
            scene.add(model);
        }),
        loadAndAttach('opponent', boxerUrl, model => {
            model.updateMatrixWorld(true);
            const bounds = new THREE.Box3().setFromObject(model);
            const height = bounds.getSize(new THREE.Vector3()).y;
            if (height > 0) model.scale.setScalar(1.72 / height);
            model.updateMatrixWorld(true);
            model.userData.floorOffset = new THREE.Box3().setFromObject(model).min.y;
            model.traverse(child => {
                if (child.isSkinnedMesh) child.frustumCulled = false;
            });
            model.visible = false;
            scene.add(model);
        }),
        loadAndAttach('leftGlove', leftGloveUrl, model => {
            placeGlove(model, 'left');
            controllers.left.add(model);
            controllers.leftFist.visible = false;
        }),
        loadAndAttach('rightGlove', rightGloveUrl, model => {
            placeGlove(model, 'right');
            controllers.right.add(model);
            controllers.rightFist.visible = false;
        })
    ]);

    return { ...results, target, playerAnchor, placeOpponent };
}

