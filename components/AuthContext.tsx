'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AuthContextType {
  isAdmin: boolean
  isLoading: boolean
  login: (password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_STORAGE_KEY = 'hibiki_admin_auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Check stored auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        try {
          // Verify with server
          const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: stored })
          })
          if (res.ok) {
            const data = await res.json()
            setIsAdmin(data.isAdmin)
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY)
          }
        } catch {
          localStorage.removeItem(AUTH_STORAGE_KEY)
        }
      }
      setIsLoading(false)
    }
    checkAuth()
  }, [])

  const login = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.token) {
          localStorage.setItem(AUTH_STORAGE_KEY, data.token)
          setIsAdmin(true)
          return true
        }
      }
      return false
    } catch {
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setIsAdmin(false)
  }

  return (
    <AuthContext.Provider value={{ isAdmin, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
