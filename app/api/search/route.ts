import { NextRequest, NextResponse } from 'next/server'
import { searchYoutube } from '@/lib/ytdlp'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    console.log('[API] Searching YouTube for:', query)

    const results = await searchYoutube(query, 10)

    console.log('[API] Found', results.length, 'results')
    return NextResponse.json(results)
  } catch (error) {
    console.error('[API] Error searching YouTube:', error)
    return NextResponse.json(
      { error: 'Failed to search YouTube' },
      { status: 500 }
    )
  }
}
