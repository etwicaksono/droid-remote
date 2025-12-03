import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-secondary text-secondary-foreground': variant === 'default',
          'bg-green-500/20 text-green-500': variant === 'success',
          'bg-yellow-500/20 text-yellow-500': variant === 'warning',
          'bg-red-500/20 text-red-500': variant === 'destructive',
          'border border-border bg-transparent': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}
