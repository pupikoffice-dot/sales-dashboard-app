import type { ReactNode } from 'react'
import { BiBadge } from './BiBadge'

export function BiCubeShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="sm-cube bi-cube">
      <div className="sm-cube-title bi-cube-title">
        <span>{title}</span>
        <BiBadge />
      </div>
      {children}
    </div>
  )
}
