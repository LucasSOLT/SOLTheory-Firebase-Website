// Generates a subtle iPhone-like "whoosh" send sound using Web Audio API
// This avoids needing an external audio file

let audioCtx: AudioContext | null = null;

export function playMessageSendSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioCtx;
    const now = ctx.currentTime;

    // Main "pop" tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    // Subtle high-frequency shimmer
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2400, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(1800, now + 0.12);
    gain2.gain.setValueAtTime(0.03, now + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.02);
    osc2.stop(now + 0.16);
  } catch (e) {
    // Silently ignore audio errors (e.g. autoplay policy)
  }
}
