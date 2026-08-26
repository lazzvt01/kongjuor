import { useState } from 'react'
import { Download, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useInstallPWA } from '@/hooks/useInstallPWA'

export function InstallAppBanner() {
  const { canInstall, install, isIOS } = useInstallPWA()
  const [hidden, setHidden] = useState(false)

  if (hidden || (!canInstall && !isIOS)) return null

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Instale o KONGjuros</p>
        <p className="truncate text-xs text-muted-foreground">
          {isIOS
            ? 'Toque em Compartilhar e depois em "Adicionar à Tela de Início".'
            : 'Acesso rápido, tela cheia e funcionamento offline.'}
        </p>
      </div>
      {!isIOS && (
        <Button size="sm" onClick={() => void install()}>
          <Download className="h-4 w-4" />
          Instalar
        </Button>
      )}
      <button
        aria-label="Fechar aviso"
        onClick={() => setHidden(true)}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
