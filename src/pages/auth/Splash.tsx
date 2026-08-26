import { Handshake } from 'lucide-react'

export function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-primary">
      <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-3xl bg-white/15">
        <Handshake className="h-10 w-10 text-white" />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">KONGjuros</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">Empréstimos simples para credores</p>
      </div>
    </div>
  )
}
