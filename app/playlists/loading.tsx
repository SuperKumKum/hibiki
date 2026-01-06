export default function PlaylistsLoading() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Navbar skeleton */}
      <div className="h-14 bg-tokyo-bg-hl border-b border-tokyo-border" />

      {/* Content */}
      <div className="flex-1 flex">
        {/* Sidebar skeleton */}
        <div className="w-80 border-r border-gray-800 p-6 hidden lg:block">
          <div className="h-12 bg-tokyo-bg-hl rounded-lg mb-4 animate-pulse" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-tokyo-bg-hl rounded-lg mb-2 animate-pulse" />
          ))}
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 p-6">
          <div className="h-8 bg-tokyo-bg-hl rounded w-48 mb-6 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-tokyo-bg-hl rounded-lg aspect-video mb-2" />
                <div className="h-4 bg-tokyo-bg-hl rounded w-3/4 mb-1" />
                <div className="h-3 bg-tokyo-bg-hl rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
