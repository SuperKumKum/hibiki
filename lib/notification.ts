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

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    // Short notification beep
    oscillator.frequency.value = 880 // A5 note
    oscillator.type = 'sine'

    // Quick fade in and out for pleasant sound
    const now = ctx.currentTime
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02)
    gainNode.gain.linearRampToValueAtTime(0, now + 0.15)

    oscillator.start(now)
    oscillator.stop(now + 0.15)
  } catch (error) {
    // Silently fail if audio is not available
    console.debug('Notification sound not available:', error)
  }
}
