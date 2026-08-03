import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { radioHub, type RadioSessionPayload } from '@/lib/radio/hub'

/**
 * SSE endpoint for real-time radio updates
 *
 * @description Thin transport layer. All radio progression and state assembly happens in
 * the process-wide radio hub, which runs one timer for every connected client. This route
 * only subscribes, forwards payloads and cleans up. It performs no timers, no polling and
 * no state mutation of its own.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // EventSource cannot send custom headers, so the session id travels as a query param
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!sessionId) {
    return new Response('Session ID required', { status: 401 })
  }

  const session = db.getSessionById(sessionId)
  if (!session) {
    return new Response('Session not found', { status: 404 })
  }

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      /**
       * Forwards one hub payload as an SSE frame
       *
       * @description Throws once the controller is closed, which the hub treats as a
       * signal to drop this subscriber.
       */
      const send = (payload: RadioSessionPayload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      // subscribe() delivers an initial payload synchronously
      unsubscribe = radioHub.subscribe(sessionId, send)

      request.signal.addEventListener('abort', () => {
        unsubscribe?.()
        unsubscribe = null
        try {
          controller.close()
        } catch {
          // Already closed by the runtime
        }
      })
    },

    cancel() {
      unsubscribe?.()
      unsubscribe = null
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable buffering for nginx
    }
  })
}
