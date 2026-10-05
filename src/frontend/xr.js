let sessionRequestPending = false;

export function initXR(renderer, { onSessionStart = () => {}, onSessionEnd = () => {} } = {}) {
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    renderer.xr.addEventListener('sessionstart', () => {
        const baseSpace = renderer.xr.getReferenceSpace();
        if (baseSpace && typeof XRRigidTransform !== 'undefined') {
            renderer.xr.setReferenceSpace(baseSpace.getOffsetReferenceSpace(
                new XRRigidTransform({ position: { x: 0, y: -0.50, z: 0 } })
            ));
        }
        onSessionStart();
    });
    renderer.xr.addEventListener('sessionend', onSessionEnd);
}

export async function enterVR(renderer) {
    if (!navigator.xr) {
        if (!window.isSecureContext) {
            throw new Error('WebXR perlu HTTPS tepercaya. Buka alamat HTTPS di headset lalu izinkan sertifikatnya sebelum menekan START MATCH.');
        }
        throw new Error('WebXR tidak tersedia di browser ini. Buka game dari browser headset yang mendukung WebXR.');
    }
    if (renderer.xr.isPresenting || renderer.xr.getSession() || sessionRequestPending) return;
    sessionRequestPending = true;
    try {
        const session = await navigator.xr.requestSession('immersive-vr', {
            requiredFeatures: ['local-floor']
        });
        await renderer.xr.setSession(session);
    } catch (error) {
        if (String(error?.message).includes('already an active')) {
            throw new Error('Sesi VR lain masih aktif. Pilih Resume lalu keluar dari sesi lama, atau tekan Quit sebelum mencoba PLAY lagi.');
        }
        throw error;
    } finally {
        sessionRequestPending = false;
    }
}

export async function exitVR(renderer) {
    const session = renderer.xr.getSession();
    if (session) await session.end();
}
