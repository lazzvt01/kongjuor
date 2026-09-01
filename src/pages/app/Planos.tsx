import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Crown, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Field } from '@/components/shared/Field'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { usePlano } from '@/hooks/usePlano'
import { validarCpfCnpj } from '@/lib/validations'
import { atualizarPerfil } from '@/services/api/auth'
import { assinarPlano, formatarPrecoPlano, listarPlanos } from '@/services/api/planos'
import type { CheckoutPix, CodigoPlano, Plano } from '@/types'

export function Planos() {
  const navigate = useNavigate()
  const { profile, refresh: refreshPerfil } = useAuth()
  const { resumo, limiteAtingido, refresh } = usePlano()
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loadingPlanos, setLoadingPlanos] = useState(true)
  const [assinando, setAssinando] = useState<CodigoPlano | null>(null)
  const [checkoutPlano, setCheckoutPlano] = useState<{ plano: Plano; pix: CheckoutPix } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [pedirDoc, setPedirDoc] = useState<Plano | null>(null)
  const [doc, setDoc] = useState(profile?.cpf_cnpj ?? '')
  const [docError, setDocError] = useState<string | null>(null)
  const [salvandoDoc, setSalvandoDoc] = useState(false)

  useEffect(() => {
    listarPlanos()
      .then(setPlanos)
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setLoadingPlanos(false))
  }, [])

  const planoAtualCodigo = resumo?.codigo ?? 'free'

  const handleAssinar = async (plano: Plano) => {
    if (plano.codigo === planoAtualCodigo) return
    if (plano.codigo === 'free') {
      const confirmado = window.confirm(
        'Voltar para o plano Free? Você manterá os empréstimos já criados, mas novos serão limitados a 5 ativos.',
      )
      if (!confirmado) return
      setAssinando('free')
      try {
        await assinarPlano('free', 'cancelar')
        toast.success('Assinatura cancelada. Você está no plano Free.')
        await refresh()
      } catch (err) {
        toast.error((err as Error).message)
      } finally {
        setAssinando(null)
      }
      return
    }

    if (!profile?.cpf_cnpj) {
      setDoc('')
      setDocError(null)
      setPedirDoc(plano)
      return
    }

    await executarAssinatura(plano, profile.cpf_cnpj)
  }

  const executarAssinatura = async (plano: Plano, cpfCnpj: string) => {
    setAssinando(plano.codigo)
    try {
      const result = await assinarPlano(plano.codigo, 'assinar', cpfCnpj)
      if (!result.ok) {
        toast.error(result.error ?? 'Erro ao gerar o Pix.')
        return
      }
      if (result.pix) {
        setCheckoutPlano({ plano, pix: result.pix })
      } else {
        toast.success('Assinatura criada. Confirme o pagamento para ativar o plano.')
      }
      await refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAssinando(null)
    }
  }

  const handleSalvarDoc = async () => {
    if (!pedirDoc) return
    const err = validarCpfCnpj(doc)
    setDocError(err)
    if (err) return
    setSalvandoDoc(true)
    try {
      await atualizarPerfil({ nome: profile?.nome ?? '', whatsapp: profile?.whatsapp ?? '', cpf_cnpj: doc.replace(/\D/g, '') })
      await refreshPerfil()
      const plano = pedirDoc
      setPedirDoc(null)
      await executarAssinatura(plano, doc.replace(/\D/g, ''))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSalvandoDoc(false)
    }
  }

  const handleCancelar = async () => {
    if (!window.confirm('Cancelar sua assinatura? Você voltará para o plano Free.')) return
    setCancelando(true)
    try {
      await assinarPlano('free', 'cancelar')
      toast.success('Assinatura cancelada.')
      await refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCancelando(false)
    }
  }

  const handleCopiarPix = async () => {
    if (!checkoutPlano) return
    try {
      await navigator.clipboard.writeText(checkoutPlano.pix.payload)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('Não foi possível copiar o Pix.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Planos" subtitle="Escolha o plano ideal para suas operações" backTo="/configuracoes" />

      {resumo && (
        <Card className={limiteAtingido ? 'border-destructive/50' : undefined}>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <Badge variant={resumo.codigo === 'free' ? 'secondary' : 'success'}>
                {resumo.nome}
              </Badge>
            </div>
            <p className="text-sm">
              {resumo.limite_ativos === null
                ? 'Empréstimos ativos ilimitados'
                : `${resumo.ativos} de ${resumo.limite_ativos} empréstimos ativos usados`}
            </p>
            {limiteAtingido && (
              <p className="text-sm font-medium text-destructive">
                Limite atingido. Faça upgrade ou quite empréstimos para liberar espaço.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {loadingPlanos && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {!loadingPlanos && (
        <div className="space-y-3">
          {planos.map((plano) => {
            const atual = plano.codigo === planoAtualCodigo
            const pagante = plano.codigo !== 'free'
            return (
              <Card
                key={plano.codigo}
                className={plano.destaque ? 'border-primary' : undefined}
              >
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold">{plano.nome}</p>
                        {atual && <Badge variant="success">Plano atual</Badge>}
                        {plano.destaque && (
                          <Badge variant="warning">
                            <Sparkles className="mr-1 h-3 w-3" /> Mais popular
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{plano.descricao}</p>
                    </div>
                    <div className="text-right">
                      {pagante ? (
                        <>
                          <p className="text-lg font-bold">{formatarPrecoPlano(plano.preco_mensal)}</p>
                          <p className="text-xs text-muted-foreground">/mês</p>
                        </>
                      ) : (
                        <p className="text-lg font-bold">Grátis</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary" />
                      {plano.limite_ativos === null
                        ? 'Empréstimos ativos ilimitados'
                        : `Até ${plano.limite_ativos} empréstimos ativos`}
                    </p>
                    {atual ? (
                      <Button variant="outline" disabled>
                        Plano atual
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleAssinar(plano)}
                        disabled={assinando !== null || cancelando}
                      >
                        {assinando === plano.codigo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {plano.codigo === 'free' ? 'Voltar para Free' : planoAtualCodigo === 'free' ? 'Assinar' : 'Trocar plano'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {resumo && resumo.codigo !== 'free' && resumo.codigo !== 'pro_max' && (
        <Button variant="outline" className="w-full" onClick={handleCancelar} disabled={cancelando}>
          {cancelando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Cancelar assinatura
        </Button>
      )}

      <Button variant="ghost" className="w-full" onClick={() => navigate(-1)}>
        Voltar
      </Button>

      <Dialog open={pedirDoc !== null} onOpenChange={(open) => !open && setPedirDoc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Assinar {pedirDoc?.nome}
            </DialogTitle>
            <DialogDescription>
              Para gerar a cobrança, o Asaas precisa do seu CPF ou CNPJ (do titular da conta).
              Ele é usado apenas para emitir a cobrança recorrente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field label="CPF ou CNPJ" error={docError ?? undefined}>
              <Input
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                inputMode="numeric"
                maxLength={18}
              />
            </Field>
            <Button className="w-full" onClick={handleSalvarDoc} disabled={salvandoDoc}>
              {salvandoDoc && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar e gerar Pix
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutPlano !== null} onOpenChange={(open) => !open && setCheckoutPlano(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Pagar assinatura {checkoutPlano?.plano.nome}
            </DialogTitle>
            <DialogDescription>
              Pague o Pix abaixo para ativar o plano. O acesso é liberado assim que o pagamento for
              confirmado.
            </DialogDescription>
          </DialogHeader>

          {checkoutPlano && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border p-4">
                <span className="text-sm text-muted-foreground">Valor mensal</span>
                <span className="text-lg font-bold">
                  {formatarPrecoPlano(checkoutPlano.plano.preco_mensal)}
                </span>
              </div>

              <div className="flex justify-center rounded-xl border bg-white p-4">
                <img
                  src={`data:image/png;base64,${checkoutPlano.pix.encodedImage}`}
                  alt="QR Code Pix"
                  className="h-48 w-48"
                />
              </div>

              <Button className="w-full" onClick={handleCopiarPix}>
                {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copiado ? 'Pix copiado!' : 'Copiar código Pix (copia e cola)'}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Aguardando pagamento. A assinatura fica <strong>pendente</strong> até a confirmação,
                que acontece automaticamente pelo Asaas.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
