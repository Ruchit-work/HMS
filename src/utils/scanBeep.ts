/**
 * Play a short beep for barcode scan feedback (Web Audio API, no file needed).
 * Use after camera or keyboard scan success.
 */
export function playScanBeep(): void {
  try {
    if (typeof window === 'undefined') return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 2400
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.08)
  } catch {
    // ignore if audio not allowed (e.g. autoplay policy)
  }
}
