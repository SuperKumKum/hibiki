import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Radio',
  description: 'Collaborative radio - listen together in sync with friends',
}

export default function RadioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
