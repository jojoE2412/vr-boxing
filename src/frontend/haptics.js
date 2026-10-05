export function triggerHaptic(handedness, intensity, duration, renderer) {
    const session = renderer?.xr?.getSession?.();
    const source = Array.from(session?.inputSources || []).find(item => item.handedness === handedness);
    const gamepad = source?.gamepad;
    if (!gamepad) return;

    const strength = Math.max(0, Math.min(1, intensity));
    const milliseconds = Math.max(0, duration);
    const actuator = gamepad.hapticActuators?.[0] || gamepad.vibrationActuator;
    if (typeof actuator?.pulse === 'function') {
        Promise.resolve(actuator.pulse(strength, milliseconds)).catch(() => {});
        return;
    }
    if (typeof actuator?.playEffect === 'function') {
        Promise.resolve(actuator.playEffect('dual-rumble', {
            duration: milliseconds,
            strongMagnitude: strength,
            weakMagnitude: strength * 0.65
        })).catch(() => {});
    }
}