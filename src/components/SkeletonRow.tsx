'use client'

interface SkeletonRowProps {
  columns: number
  height?: string
}

export default function SkeletonRow({ columns, height = '48px' }: SkeletonRowProps) {
  return (
    <tr className="animate-pulse" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: '1rem', height }}>
          <div 
            style={{ 
              height: '16px', 
              background: 'rgba(255, 255, 255, 0.06)', 
              borderRadius: '4px',
              width: i === 0 ? '60%' : i === columns - 1 ? '40%' : '80%'
            }} 
          />
        </td>
      ))}
    </tr>
  )
}
