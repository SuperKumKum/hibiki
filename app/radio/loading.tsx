export default function RadioLoading() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Navbar skeleton */}
      <div className="h-14 bg-tokyo-bg-hl border-b border-tokyo-border" />

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Player skeleton */}
          <div className="bg-tokyo-bg-hl rounded-xl p-6 mb-6 animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-32 h-32 bg-tokyo-bg rounded-lg" />
              <div className="flex-1">
                <div className="h-6 bg-tokyo-bg rounded w-3/4 mb-2" />
                <div className="h-4 bg-tokyo-bg rounded w-1/2" />
              </div>
            </div>
            <div className="h-2 bg-tokyo-bg rounded-full mb-4" />
            <div className="flex justify-between">
              <div className="h-12 bg-tokyo-bg rounded-full w-32" />
              <div className="h-12 bg-tokyo-bg rounded w-24" />
            </div>
          </div>

          {/* Queue skeleton */}
          <div className="bg-tokyo-bg-hl rounded-xl p-4 animate-pulse">
            <div className="h-6 bg-tokyo-bg rounded w-24 mb-4" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 mb-2">
                <div className="w-10 h-10 bg-tokyo-bg rounded" />
                <div className="flex-1">
                  <div className="h-4 bg-tokyo-bg rounded w-3/4 mb-1" />
                  <div className="h-3 bg-tokyo-bg rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
