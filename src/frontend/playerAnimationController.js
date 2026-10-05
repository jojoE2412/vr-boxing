import * as THREE from 'three';

const ACTION_DURATION = {
    LEFT_PUNCH: 0.62,
    RIGHT_PUNCH: 0.62,
    HIT_REACTION: 0.46,
    VICTORY: 1.10,
    DEFEAT: 1.10
};

export class PlayerAnimationController {
    constructor(model, clips = []) {
        this.model = model;
        this.mixer = new THREE.AnimationMixer(model);
        this.baseAction = clips[0] ? this.mixer.clipAction(clips[0]) : null;
        this.locomotionState = 'IDLE';
        this.action = 'NONE';
        this.actionElapsed = 0;
        this.walkPhase = 0;
        this.walkBlend = 0;
        this.offsetEuler = new THREE.Euler();
        this.offsetQuaternion = new THREE.Quaternion();
        this.lastLoggedState = '';
        this.bones = {
            shoulderL: model.getObjectByName('DEF-shoulderL_120'),
            upperArmL: model.getObjectByName('DEF-upper_armL_230'),
            forearmL: model.getObjectByName('DEF-forearmL_228'),
            handL: model.getObjectByName('DEF-handL_226'),
            shoulderR: model.getObjectByName('DEF-shoulderR_244'),
            upperArmR: model.getObjectByName('DEF-upper_armR_354'),
            forearmR: model.getObjectByName('DEF-forearmR_352'),
            handR: model.getObjectByName('DEF-handR_350'),
            spine: model.getObjectByName('DEF-spine_6'),
            thighL: model.getObjectByName('DEF-thighL_64'),
            shinL: model.getObjectByName('DEF-shinL_62'),
            footL: model.getObjectByName('DEF-footL_60'),
            thighR: model.getObjectByName('DEF-thighR_83'),
            shinR: model.getObjectByName('DEF-shinR_81'),
            footR: model.getObjectByName('DEF-footR_79')
        };

        if (this.baseAction) {
            this.baseAction.setLoop(THREE.LoopRepeat, Infinity);
            this.baseAction.play();
        }
        this.logState('IDLE');
    }

    playIdle() {
        this.action = 'NONE';
        this.actionElapsed = 0;
        this.setLocomotion('IDLE');
    }

    playWalk() {
        this.setLocomotion('WALK');
    }

    playLeftPunch() {
        this.playAction('LEFT_PUNCH');
    }

    playRightPunch() {
        this.playAction('RIGHT_PUNCH');
    }

    playHitReaction() {
        this.playAction('HIT_REACTION');
    }

    playVictory() {
        this.playAction('VICTORY');
    }

    playDefeat() {
        this.playAction('DEFEAT');
    }

    setLocomotion(state) {
        const nextState = state === 'WALK' || state === 'RUN' ? 'WALK' : 'IDLE';
        if (this.locomotionState === nextState) return;
        this.locomotionState = nextState;
        if (this.action === 'NONE') this.logState(nextState);
    }

    playAction(action) {
        if (!ACTION_DURATION[action]) return;
        this.action = action;
        this.actionElapsed = 0;
        this.logState(action);
    }

    update(delta, movementState = this.locomotionState) {
        this.setLocomotion(movementState);
        this.mixer.update(delta);
        this.walkPhase += delta * (this.locomotionState === 'WALK' ? 8 : 0);
        const walkTarget = this.locomotionState === 'WALK' ? 1 : 0;
        this.walkBlend = THREE.MathUtils.damp(this.walkBlend, walkTarget, 9, delta);
        this.applyWalkPose();

        if (this.action === 'NONE') return;
        this.actionElapsed += delta;
        const duration = ACTION_DURATION[this.action];
        const progress = THREE.MathUtils.clamp(this.actionElapsed / duration, 0, 1);
        this.applyActionPose(progress);

        if (progress >= 1) {
            if (this.action === 'VICTORY' || this.action === 'DEFEAT') {
                this.actionElapsed = duration;
                return;
            }
            this.action = 'NONE';
            this.actionElapsed = 0;
            this.logState(this.locomotionState);
        }
    }

    applyWalkPose() {
        const stride = Math.sin(this.walkPhase) * this.walkBlend;
        const oppositeStride = -stride;
        this.rotate(this.bones.thighL, stride * 0.34, 0, 0);
        this.rotate(this.bones.shinL, Math.max(0, -stride) * 0.48, 0, 0);
        this.rotate(this.bones.footL, -stride * 0.13, 0, 0);
        this.rotate(this.bones.thighR, oppositeStride * 0.34, 0, 0);
        this.rotate(this.bones.shinR, Math.max(0, -oppositeStride) * 0.48, 0, 0);
        this.rotate(this.bones.footR, -oppositeStride * 0.13, 0, 0);
    }

    applyActionPose(progress) {
        const terminal = this.action === 'VICTORY' || this.action === 'DEFEAT';
        const punchProgress = terminal
            ? THREE.MathUtils.smoothstep(progress, 0, 0.78)
            : Math.sin(Math.PI * progress);
        const settle = terminal || progress < 0.72 ? punchProgress : punchProgress * 0.55;
        switch (this.action) {
            case 'LEFT_PUNCH':
                this.punchPose('L', settle);
                break;
            case 'RIGHT_PUNCH':
                this.punchPose('R', settle);
                break;
            case 'HIT_REACTION':
                this.rotate(this.bones.spine, 0.12 * settle, 0, -0.24 * settle);
                this.rotate(this.bones.shoulderL, 0, 0, 0.10 * settle);
                this.rotate(this.bones.shoulderR, 0, 0, -0.10 * settle);
                break;
            case 'VICTORY':
                this.rotate(this.bones.upperArmL, -1.1 * settle, 0, -0.32 * settle);
                this.rotate(this.bones.upperArmR, -1.1 * settle, 0, 0.32 * settle);
                this.rotate(this.bones.spine, -0.12 * settle, 0, 0);
                break;
            case 'DEFEAT':
                this.rotate(this.bones.upperArmL, 0.34 * settle, 0, 0.12 * settle);
                this.rotate(this.bones.upperArmR, 0.34 * settle, 0, -0.12 * settle);
                this.rotate(this.bones.spine, 0.30 * settle, 0, 0);
                this.rotate(this.bones.thighL, 0.32 * settle, 0, 0);
                this.rotate(this.bones.thighR, 0.32 * settle, 0, 0);
                break;
            default:
                break;
        }
    }

    punchPose(side, amount) {
        const sign = side === 'L' ? 1 : -1;
        this.rotate(this.bones[`shoulder${side}`], 0, 0, -0.10 * sign * amount);
        this.rotate(this.bones[`upperArm${side}`], 1.10 * sign * amount, 0, 0.18 * sign * amount);
        this.rotate(this.bones[`forearm${side}`], -0.70 * sign * amount, 0, 0);
        this.rotate(this.bones[`hand${side}`], -0.16 * sign * amount, 0, 0);
    }

    rotate(bone, x, y, z) {
        if (!bone || Math.abs(x) + Math.abs(y) + Math.abs(z) < 1e-5) return;
        this.offsetEuler.set(x, y, z);
        this.offsetQuaternion.setFromEuler(this.offsetEuler);
        bone.quaternion.multiply(this.offsetQuaternion).normalize();
    }

    logState(state) {
        if (this.lastLoggedState === state) return;
        this.lastLoggedState = state;
        console.info(`[ANIMATION] ${state}`);
    }
}