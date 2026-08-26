import { formatarMoeda } from '@/services/financial'

export function Money({ valor, className }: { valor: number; className?: string }) {
  return <span className={className}>{formatarMoeda(valor)}</span>
}
