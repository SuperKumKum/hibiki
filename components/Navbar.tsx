'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, ListMusic, Radio, Crown, LogOut } from 'lucide-react'
import { useAuth } from '@/components/AuthContext'
import AdminLoginModal from '@/components/AdminLoginModal'

export default function Navbar() {
  const pathname = usePathname()
  const { isAdmin, login, logout } = useAuth()
  const [showAdminLogin, setShowAdminLogin] = useState(false)

  const handleAdminAuth = async (password: string) => {
    return await login(password)
  }

  const isActive = (path: string) => pathname === path

  return (
    <nav className="bg-tokyo-bg-hl border-b border-tokyo-border sticky top-0 z-40 flex-shrink-0">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/" className="flex items-center gap-2">
                <svg className="w-auto h-10" viewBox="0 0 1006 417" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="hibiki-gradient" x1="191.415" y1="398.346" x2="-186.858" y2="-49.693" gradientTransform="matrix(.00103 0 0 .00516 .497 -.674)">
                      <stop stopColor="#7dcfff"/>
                      <stop offset="1" stopColor="#7aa2f7"/>
                    </linearGradient>
                  </defs>
                  <path d="M326.695 83.296c8.595 3.823 12.42 13.924 8.517 22.485s-14.04 12.296-22.563 8.316c-8.414-3.93-12.087-13.907-8.233-22.357s13.796-12.219 22.28-8.444m25.426-36.472c6.954 3.335 9.95 11.63 6.73 18.64-3.218 7.01-11.461 10.145-18.523 7.046a14.13 14.13 0 0 1-8.381-11.546 14.14 14.14 0 0 1 5.955-12.968 14.13 14.13 0 0 1 14.22-1.172m10.72 67.617c7.15 2.502 10.92 10.327 8.418 17.48-2.5 7.153-10.324 10.926-17.477 8.43-7.156-2.498-10.93-10.327-8.428-17.483s10.333-10.93 17.487-8.427m27.426 25.932a7.956 7.956 0 0 1 3.02 13.595 7.957 7.957 0 0 1-12.843-8.417 7.96 7.96 0 0 1 9.823-5.178" fill="#bb9af7"/>
                  <path d="M29.496 256.116c-74.924 6.012-119.323-5.86-186.028-37.14-78.776-36.942-164.198-77.14-252.36-50.963-23.092 6.425-55.347 17.054-74.384 32.351 48.583-2.448 87.566-8.65 136.991.009 120.819 21.168 215.016 113.153 338.737 123.189 18.68 1.515 37.723 1.615 56.209.061 57.027-4.795 114.192-21.163 163.026-51.44 23.473-14.37 43.513-30.988 65.223-47.514 47.62-36.263 98.19-69.006 159.69-72.894 18.75-1.186 34.71-.042 53.26 1.38-92.61-46.25-169.82-14.052-251.96 35.153-89.877 53.841-202.871 104.435-308.84 75.58-2.47-.673-7.424-1.608-9.344-2.993 2.651-.174 23.081 2.565 28.588 2.837a325.8 325.8 0 0 0 82.932-6.065c3.716-.376 11.548-1.896 14.993-3.052-3.167-.417-13.378.807-16.733 1.501" fill="url(#hibiki-gradient)" transform="translate(501.933 81.934)"/>
                  <path d="M189.18 175.906c9.485-.92 25.833.16 35.258.941 107.996 8.946 178.293 97.902 277.523 130.041 31.669 10.257 53.985 12.565 86.791 12.639a309.6 309.6 0 0 1-60.677 8.99c-53.45 2.946-89.423-4.902-137.683-28.144-33.597-16.472-63.16-32.05-97.885-46.216C177.63 207.293 110.058 217.501 0 262.539c54.582-50.983 114.217-82.018 189.18-86.633" fill="#3d59a1"/>
                  <path d="M448.653 251.353c46.422 24.971 115.515 31.259 165.96 15.055 28.098-9.025 55.061-22.452 80.506-37.529 79.164-50.915 175.354-85.766 265.544-39.795 19.32 9.849 32.84 21.596 46.29 38.873-9.86-6.446-17.33-11.212-27.94-16.204-38.35-18.046-84.56-17.91-125.32-9.282-104.39 22.094-178.632 114.635-292.758 100.053-8.813-1.126-32.44-4.455-40.025-8.237-1.133-1.509-19.63-8.753-22.681-10.233-18.799-9.117-40.405-21.151-56.169-34.719 2.788.571 3.968.725 6.593 2.018" fill="#7dcfff"/>
                  <path d="M473.087 415.035c-41.712-7.332-75.976-19.285-113.704-38.334-37.666-19.016-73.759-40.604-113.296-55.767-10.661-4.088-26.188-10.021-37.246-12.411-44.38-14.844-105.916-16.397-148.812 4.914a101 101 0 0 0-14.29 8.565c55.89-12.448 102.487-4.077 156.163 10.681 38.782 14.026 69.344 28.705 106.384 45.899 45.8 21.259 111.179 37.27 161.976 38.589 6.687.315 14.002.794 20.64.745l2.553.052c.338-.797-.387-.384-1.184-.797-5.09-.195-14.081-1.545-19.184-2.136m423.936-156.663c17.59-2.142 35.04 1.711 49.31 12.377-15.9-.132-30.2-.673-45.81 2.984-46.91 10.991-84.96 43.512-124.35 68.846a473 473 0 0 1-63.797 34.553c-7.707 3.083-27.146 10.753-35.039 12.376 2.155-1.753 17.66-7.939 22.307-10.28a297 297 0 0 0 29.968-17.492c52.601-34.464 104.211-95.012 167.411-103.364m69.82-3.002a8.62 8.62 0 0 1 8.62 1.794 8.62 8.62 0 0 1 2.55 8.43 8.6 8.6 0 0 1-6.18 6.273 8.62 8.62 0 0 1-10.44-5.845c-1.34-4.439 1.07-9.146 5.45-10.652" fill="#7aa2f7"/>
                  <path d="m488.35 0 .051 35.834c-25.847-.22-58.16-1.307-83.725-.344 2.28 5.905 5.074 13.334 8.366 18.738 39.106-4.54 35.632.435 44.242 34.708-28.085.34-57.134-.215-85.343-.27 2.477 4.848 7.048 13.14 9.05 17.865l204.758.881c8.785.054 42.218 1.925 47.5-2.912a5.38 5.38 0 0 0 1.76-4.147c-.196-7.52-22.59-25.193-29.909-24.667-9.685 8.084-10.576 7.778-19.41 13.808l-51.929-.04c6.625-5.504 31.125-20.09 27.122-27.634-4.44-3.26-11.558-4.872-17.214-7.935 9.417.001 48.503 2.394 54.098-3.104 1.282-1.26 1.691-2.814 1.44-4.564-.938-6.54-12.612-14.926-18.088-18.362-2.976-1.868-7.47-4.338-11.069-3.602-5.708 1.168-10.997 8.144-15.083 12.032l-39.872-.167c.022-4.476-.169-11.73.213-15.985 4.298-2.844 13.952-7.004 10.652-12.63C520.368 3.491 495.853.308 488.35 0m-28.51 54.09c21.84-.259 49.2-.702 70.75.302-3.473 8.376-7.294 20.133-10.619 28.99l-2.868 6.524-40.682-.112a57 57 0 0 0 2.497-3.687c10.474-17.02-6.67-25.342-19.077-32.017m99.671 59.766c-3.21 5.532-4.549 7.704-9.59 11.601-30.607-.124-63.205-.81-93.659-.16-7.57-11.892-15.697-8.229-28.242-8.294 1.746 42.08-.016 76.567-.545 117.953 7.084.101 26.568 2.751 28.231-6.16.661-2.603.435-3.915 2.228-5 28.567-1.083 65.36-.13 94.515.052l.025 11.183c7.42.068 19.96 1.205 26.03-2.292 4.3-5.772 2.235-75.2 2.213-87.545 4.132-3.235 10.363-10.304 13.47-14.554-5.664-2.659-30.969-15.836-34.676-16.784m-102.92 29.871 95.817.435-.142 21.436c-31.446.451-64.266-.246-95.94-.182-.016-7.168.166-14.507.265-21.689m6.415 39.861c28.891-.592 60.501.166 89.567.296.054 4.258 1 17.087-.83 20.944-.397.837-2.008.585-3.297.634l-91.898-.412c.037-7.008-1.59-14.362.931-20.43 2.158-1.478 2.577-.992 5.527-1.032" fill="#bb9af7"/>
                </svg>
            </Link>

            {/* Navigation Links - Desktop */}
            <div className="hidden sm:flex items-center gap-4">
              <Link
                href="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive('/')
                    ? 'bg-tokyo-bg-menu text-tokyo-fg'
                    : 'text-tokyo-comment hover:text-tokyo-fg hover:bg-tokyo-bg-menu'
                }`}
              >
                <Home size={20} />
                <span className="font-medium">Home</span>
              </Link>

              <Link
                href="/playlists"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive('/playlists')
                    ? 'bg-tokyo-bg-menu text-tokyo-fg'
                    : 'text-tokyo-comment hover:text-tokyo-fg hover:bg-tokyo-bg-menu'
                }`}
              >
                <ListMusic size={20} />
                <span className="font-medium">Playlists</span>
              </Link>

              <Link
                href="/radio"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive('/radio')
                    ? 'bg-tokyo-purple text-white'
                    : 'text-tokyo-purple hover:text-white hover:bg-tokyo-purple/20'
                }`}
              >
                <Radio size={20} />
                <span className="font-medium">Radio</span>
              </Link>
            </div>
          </div>

          {/* Admin Button - Desktop */}
          <div className="hidden sm:flex items-center">
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 px-3 py-1.5 bg-tokyo-yellow/20 text-tokyo-yellow rounded-lg text-sm font-medium">
                  <Crown size={16} />
                  Admin
                </span>
                <button
                  onClick={logout}
                  className="p-2 text-tokyo-comment hover:text-tokyo-red hover:bg-tokyo-red/10 rounded-lg transition-colors"
                  title="Logout Admin"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="flex items-center gap-2 px-3 py-2 text-tokyo-comment hover:text-tokyo-yellow hover:bg-tokyo-yellow/10 rounded-lg transition-colors"
              >
                <Crown size={18} />
                <span className="text-sm font-medium">Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="sm:hidden flex gap-2 pb-2">
          <Link
            href="/"
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isActive('/')
                ? 'bg-tokyo-bg-menu text-tokyo-fg'
                : 'text-tokyo-comment hover:text-tokyo-fg hover:bg-tokyo-bg-menu'
            }`}
          >
            <Home size={16} />
            <span className="text-xs font-medium">Home</span>
          </Link>

          <Link
            href="/playlists"
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isActive('/playlists')
                ? 'bg-tokyo-bg-menu text-tokyo-fg'
                : 'text-tokyo-comment hover:text-tokyo-fg hover:bg-tokyo-bg-menu'
            }`}
          >
            <ListMusic size={16} />
            <span className="text-xs font-medium">Playlists</span>
          </Link>

          <Link
            href="/radio"
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isActive('/radio')
                ? 'bg-tokyo-purple text-white'
                : 'text-tokyo-purple hover:text-white hover:bg-tokyo-purple/20'
            }`}
          >
            <Radio size={16} />
            <span className="text-xs font-medium">Radio</span>
          </Link>

          {/* Admin Button - Mobile */}
          {isAdmin ? (
            <button
              onClick={logout}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-tokyo-yellow/20 text-tokyo-yellow rounded-lg"
              title="Logout Admin"
            >
              <Crown size={16} />
            </button>
          ) : (
            <button
              onClick={() => setShowAdminLogin(true)}
              className="flex items-center justify-center gap-1 px-3 py-2 text-tokyo-comment hover:text-tokyo-yellow hover:bg-tokyo-yellow/10 rounded-lg transition-colors"
            >
              <Crown size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <AdminLoginModal
          onSubmit={handleAdminAuth}
          onClose={() => setShowAdminLogin(false)}
        />
      )}
    </nav>
  )
}
