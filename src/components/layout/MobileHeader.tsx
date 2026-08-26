import { Handshake } from 'lucide-react'

export function MobileHeader() {
  return (
    <header className="safe-top sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Handshake className="h-4.5 w-4.5" />
        </div>
        <span className="text-base font-bold tracking-tight">KONGjuros</span>
      </div>
    </header>
  )
}
