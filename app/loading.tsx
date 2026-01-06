export default function Loading() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Navbar skeleton */}
      <div className="h-14 bg-tokyo-bg-hl border-b border-tokyo-border" />

      {/* Header skeleton */}
      <div className="bg-gradient-to-b from-tokyo-bg-hl to-tokyo-bg border-b border-tokyo-border p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="h-12 bg-tokyo-bg-menu rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <main className="flex-1 overflow-y-auto pb-36 sm:pb-32 p-3 sm:p-6">
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-tokyo-bg-hl rounded-lg aspect-video mb-2" />
              <div className="h-4 bg-tokyo-bg-hl rounded w-3/4 mb-1" />
              <div className="h-3 bg-tokyo-bg-hl rounded w-1/2" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
