import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const SECRET_KEY = process.env.AUTH_SECRET || 'hibiki-secret-key-change-in-production'

export interface TokenPayload {
  isAdmin: boolean
  exp: number
}

// Verify a signed token
export function verifyToken(token: string): TokenPayload | null {
  try {
    const [data, signature] = token.split('.')
    if (!data || !signature) return null

    // Verify signature
    const expectedSignature = createHmac('sha256', SECRET_KEY).update(data).digest('base64url')
    if (signature !== expectedSignature) return null

    // Parse payload
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString())

    // Check expiration
    if (payload.exp && payload.exp < Date.now()) return null

    return { isAdmin: payload.isAdmin === true, exp: payload.exp }
  } catch {
    return null
  }
}

// Generate a signed token
export function generateToken(): string {
  const payload = {
    isAdmin: true,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', SECRET_KEY).update(data).digest('base64url')
  return `${data}.${signature}`
}

// Check if request is from admin (for API routes)
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  // Check cookie
  const cookieToken = request.cookies.get('hibiki_admin_token')?.value
  if (cookieToken) {
    const payload = verifyToken(cookieToken)
    if (payload?.isAdmin) return true
  }

  // Check Authorization header
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    if (payload?.isAdmin) return true
  }

  return false
}

// Check admin from server component (using cookies)
export async function isAdminFromCookies(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('hibiki_admin_token')?.value
    if (!token) return false

    const payload = verifyToken(token)
    return payload?.isAdmin === true
  } catch {
    return false
  }
}
