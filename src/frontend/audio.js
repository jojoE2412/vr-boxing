import hitSoundUrl from '../assets/audio/HIT.wav';
import perfectSoundUrl from '../assets/audio/PERFECT.wav';
import missSoundUrl from '../assets/audio/MISS.wav';

export function initAudio() {
    let context = null;
    let ready = null;
    const buffers = {};
    const sources = { hit: hitSoundUrl, perfect: perfectSoundUrl, miss: missSoundUrl };

    return {
        async unlock() {
            if (!context) context = new AudioContext();
            await context.resume();
            if (!ready) {
                ready = Promise.all(Object.entries(sources).map(async ([name, url]) => {
                    try {
                        const response = await fetch(url);
                        buffers[name] = await context.decodeAudioData(await response.arrayBuffer());
                    } catch (error) {
                        console.warn(`[AUDIO] ${name} load failed`, error);
                    }
                }));
            }
            await ready;
        },
        play(name, volume = 0.65) {
            if (!context || !buffers[name]) return;
            const source = context.createBufferSource();
            const gain = context.createGain();
            source.buffer = buffers[name];
            gain.gain.value = volume;
            source.connect(gain);
            gain.connect(context.destination);
            source.start(0);
        }
    };
}


