// Notification sound utility using Web Audio API
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return audioContext
}

export function playNotificationSound() {
  try {
    const ctx = getAudioContext()

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const now = ctx.currentTime

    // First note (higher pitch)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.value = 880 // A5
    osc1.type = 'sine'
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.02)
    gain1.gain.linearRampToValueAtTime(0, now + 0.15)
    osc1.start(now)
    osc1.stop(now + 0.15)

    // Second note (lower pitch) - ding-dong effect
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.value = 659 // E5
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0, now + 0.12)
    gain2.gain.linearRampToValueAtTime(0.4, now + 0.14)
    gain2.gain.linearRampToValueAtTime(0, now + 0.35)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.35)
  } catch (error) {
    // Silently fail if audio is not available
    console.debug('Notification sound not available:', error)
  }
}
