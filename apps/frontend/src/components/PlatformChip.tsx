import { cn } from '@/lib/utils'
import {
  Camera, Music, Send, Users, Play, Briefcase, X, Grid2x2,
} from 'lucide-react'

type Platform =
  | 'Instagram' | 'TikTok' | 'Telegram' | 'VK'
  | 'YouTube' | 'LinkedIn' | 'X' | 'Pinterest'

const PLATFORM_MAP: Record<Platform, { bg: string; fg: string; icon: React.ElementType }> = {
  Instagram: { bg: '#FBEAF0', fg: '#72243E', icon: Camera },
  TikTok:    { bg: '#F1EFE8', fg: '#2C2C2A', icon: Music },
  Telegram:  { bg: '#E6F1FB', fg: '#0C447C', icon: Send },
  VK:        { bg: '#E6F1FB', fg: '#0C447C', icon: Users },
  YouTube:   { bg: '#FCEBEB', fg: '#791F1F', icon: Play },
  LinkedIn:  { bg: '#E6F1FB', fg: '#185FA5', icon: Briefcase },
  X:         { bg: '#F3F3F3', fg: '#1C1C1C', icon: X },
  Pinterest: { bg: '#FCEBEB', fg: '#791F1F', icon: Grid2x2 },
}

type Props = {
  platform: string
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md'
}

export default function PlatformChip({ platform, selected, onClick, size = 'md' }: Props) {
  const config = PLATFORM_MAP[platform as Platform]
  if (!config) return null
  const { bg, fg, icon: Icon } = config

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-all',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        selected
          ? 'ring-2 ring-offset-1 opacity-100'
          : 'opacity-80 hover:opacity-100',
        onClick ? 'cursor-pointer' : 'cursor-default'
      )}
      style={{
        backgroundColor: bg,
        color: fg,
        borderColor: `${fg}40`,
        ...(selected ? { outlineColor: fg } : {}),
      }}
    >
      <Icon size={size === 'sm' ? 10 : 12} />
      {platform}
    </button>
  )
}
