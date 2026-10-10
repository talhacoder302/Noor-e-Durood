"use client";

export const MILESTONES = [33, 100, 313] as const;

/** 33, 100, 313, then every thousand. */
export function isMilestone(n: number): boolean {
  return (MILESTONES as readonly number[]).includes(n) || (n >= 1000 && n % 1000 === 0);
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported (e.g. iOS Safari).
  }
}

let audio: AudioContext | null = null;

/** A short, soft click made on the fly (no audio file to download). */
export function playClick(strong = false) {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(strong ? 880 : 620, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(strong ? 0.12 : 0.06, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (strong ? 0.25 : 0.06));
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Audio blocked or unsupported.
  }
}
