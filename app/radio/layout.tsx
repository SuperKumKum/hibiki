import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Radio',
  description: 'Collaborative radio - listen together in sync with friends',
}

// Force dynamic rendering to avoid SSR/prerender issues
export const dynamic = 'force-dynamic'

export default function RadioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
