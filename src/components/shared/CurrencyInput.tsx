import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { centavosParaTexto, moedaParaCentavos } from '@/services/financial'

interface CurrencyInputProps {
  value: number
  onChange: (centavos: number) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  disabled?: boolean
}

function formatarEnquantoDigita(texto: string): string {
  const raw = texto.replace(/\s/g, '')
  const idx = raw.indexOf(',')
  const temDecimal = idx !== -1
  const intRaw = temDecimal ? raw.slice(0, idx) : raw
  const decRaw = temDecimal ? raw.slice(idx + 1) : ''
  const intDigitos = intRaw.replace(/\D/g, '').replace(/^0+(?=\d)/, '') || '0'
  const decDigitos = decRaw.replace(/\D/g, '').slice(0, 2)
  const inteiro = intDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (!temDecimal) return inteiro
  if (!decDigitos) return `${inteiro},`
  return `${inteiro},${decDigitos}`
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  className,
  autoFocus,
  disabled,
}: CurrencyInputProps) {
  const [texto, setTexto] = useState(value > 0 ? centavosParaTexto(value) : '')

  useEffect(() => {
    const novoTexto = value > 0 ? centavosParaTexto(value) : ''
    setTexto((atual) => (moedaParaCentavos(atual) === value ? atual : novoTexto))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = formatarEnquantoDigita(e.target.value)
    setTexto(formatado)
    onChange(moedaParaCentavos(formatado))
  }

  const handleBlur = () => {
    setTexto((atual) => {
      if (!atual) return atual
      const centavos = moedaParaCentavos(atual)
      return centavos > 0 ? centavosParaTexto(centavos) : atual
    })
  }

  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        R$
      </span>
      <Input
        type="text"
        inputMode="decimal"
        value={texto}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="pl-9 text-base font-medium"
        autoFocus={autoFocus}
        disabled={disabled}
      />
    </div>
  )
}
