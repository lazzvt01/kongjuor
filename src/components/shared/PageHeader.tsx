import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backTo?: string
  onBack?: () => void
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, backTo, onBack, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {(backTo || onBack) && (
        <Button variant="ghost" size="icon" asChild={!!backTo} onClick={onBack} aria-label="Voltar">
          {backTo ? (
            <Link to={backTo}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : (
            <ArrowLeft className="h-5 w-5" />
          )}
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
