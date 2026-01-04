'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, ListMusic, Radio } from 'lucide-react'

export default function Navbar() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <nav className="bg-tokyo-bg-hl border-b border-tokyo-border sticky top-0 z-40 flex-shrink-0">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/" className="flex items-center gap-2">
                <svg className="w-auto h-10" viewBox="0 0 852 506" version="1.1" xmlns="http://www.w3.org/2000/svg" style={{fillRule: 'evenodd', clipRule: 'evenodd', strokeLinejoin: 'round', strokeMiterlimit: 2}}>
                  <g id="Waves">
                    <path d="M0,388.043c0,-0 133.29,-137.605 284.799,-32.604c0,0 17.164,11.966 38.897,29.018c37.35,29.304 91.942,69.883 123.16,63.518c0,0 -53.699,32.124 -162.057,-48.425c-16.016,-11.906 -39.235,-20.266 -55.138,-27.402c-91.685,-41.138 -172.05,-10.664 -229.661,15.895Z" style={{fill: '#3d59a1'}}/>
                    <path d="M381.65,408.18c-0,-0 12.381,6.563 35.65,6.539c11.594,-0.012 23.368,1.224 42.68,-6.539c16.71,-6.717 37.429,-21.864 60.614,-36.918c15.662,-10.17 44.131,-23.329 62.429,-38.357c0,-0 143.838,-84.865 268.977,53.699c0,0 -128.016,-101.166 -268.977,-10.548c-140.961,90.618 -157.263,53.7 -201.373,32.124Z" style={{fill: '#7dcfff'}}/>
                    <path d="M48.425,398.111c0,0 96.851,-87.261 261.306,35.001c0,-0 93.495,77.672 212.401,-0c-0,-0 165.893,-145.276 285.278,-42.672c0,-0 -118.179,-48.15 -202.416,32.658c-17.934,17.203 -57.272,42.898 -82.862,61.795c-0,0 -113.632,55.138 -212.401,-12.945c-98.769,-68.083 -140.961,-104.043 -261.306,-73.837Z" style={{fill: '#7aa2f7'}}/>
                  </g>
                  <path id="Kanji" d="M321.132,165.008l31.294,12.091l140.114,-0l10.669,-12.091l34.14,24.893l-10.669,17.07l-0,142.248c-0,-0 7.824,28.449 -50.498,31.294c-0,0 4.267,-18.492 -31.295,-24.893c0,-0 -11.379,-17.07 9.958,-14.936l27.027,4.267c-0,0 10.668,0 10.668,-14.224l0,-28.45l-140.114,-0l0,66.857c0,-0 -17.781,28.449 -31.294,-0l-0,-204.126Zm31.294,86.06l0,28.449l140.114,0l0,-28.449l-140.114,-0Zm0,-51.21l0,29.161l140.826,0l-0,-29.161l-140.826,0Z" style={{fill: '#bb9af7'}}/>
                  <path d="M361.672,128.023c0,0 -12.091,-50.498 -18.492,-53.343c-6.401,-2.845 -46.942,2.845 -46.942,2.845l-9.957,-25.604l119.488,-0l0,-51.921l42.675,7.824c-0,-0 19.203,3.556 -7.824,20.626l-0,23.471l71.124,-0l15.647,-14.937c0,0 4.979,-7.823 16.359,0c11.38,7.824 19.914,20.626 19.914,20.626c0,0 9.958,9.958 0,17.07c-9.957,7.113 -73.257,0 -73.257,0l15.647,7.113c0,-0 15.647,9.957 0,18.492c-15.647,8.535 -31.295,27.738 -31.295,27.738l68.991,0l19.914,-13.513c0,-0 2.134,-13.514 15.648,-0l13.513,13.513c0,0 20.626,17.07 0,24.894l-331.438,-0l-11.379,-24.894l111.664,0Zm0,-53.343c0,0 51.21,18.492 23.471,53.343l68.279,0l18.492,-53.343l-110.242,0Z" style={{fill: '#bb9af7'}}/>
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
        </div>
      </div>
    </nav>
  )
}
