import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    // Also check cookie
    const cookieToken = request.cookies.get('hibiki_admin_token')?.value

    const tokenToVerify = token || cookieToken

    if (!tokenToVerify) {
      return NextResponse.json(
        { isAdmin: false },
        { status: 200 }
      )
    }

    const result = verifyToken(tokenToVerify)

    if (!result) {
      return NextResponse.json(
        { isAdmin: false },
        { status: 200 }
      )
    }

    return NextResponse.json({ isAdmin: result.isAdmin })
  } catch (error) {
    console.error('Error verifying token:', error)
    return NextResponse.json(
      { isAdmin: false },
      { status: 200 }
    )
  }
}
