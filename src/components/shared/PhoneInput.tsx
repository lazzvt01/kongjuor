import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface PhoneInputProps {
  id?: string
  value: string
  onChange: (whatsapp: string) => void
  placeholder?: string
  className?: string
}

function mascaraTelefone(digitos: string): string {
  const d = digitos.slice(0, 13)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function PhoneInput({ id, value, onChange, placeholder = '(00) 00000-0000', className }: PhoneInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitos = e.target.value.replace(/\D/g, '')
    onChange(mascaraTelefone(digitos))
  }

  return (
    <Input
      id={id}
      type="tel"
      inputMode="tel"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn(className)}
    />
  )
}
