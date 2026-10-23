"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Monitor,
  Plus,
  Power,
  Printer,
  RefreshCw,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type PrintDevice = {
  id: string
  device_name: string
  printer_name: string | null
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

type TokenReveal = {
  token: string
  deviceName: string
  reason: "created" | "rotated"
}

type PendingAction = {
  type: "rotate" | "deactivate"
  device: PrintDevice
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000

function formatDateTime(value: string | null) {
  if (!value) return "Nunca conectado"

  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isRecentlySeen(value: string | null) {
  if (!value) return false

  return Date.now() - new Date(value).getTime() < ONLINE_WINDOW_MS
}

async function readJson(response: Response) {
  return response.json().catch(() => null)
}

function DeviceStatus({ device }: { device: PrintDevice }) {
  if (!device.is_active) {
    return <Badge variant="outline">Desativado</Badge>
  }

  if (isRecentlySeen(device.last_seen_at)) {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
        Conectado
      </Badge>
    )
  }

  return <Badge variant="secondary">Ativo, offline</Badge>
}

function DeviceSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="rounded-xl border border-border bg-card p-5"
        >
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="mb-2 h-3 w-56" />
          <Skeleton className="h-3 w-44" />
        </div>
      ))}
    </div>
  )
}

export default function DispositivosImpressaoPage() {
  const [devices, setDevices] = useState<PrintDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [deviceName, setDeviceName] = useState("")
  const [printerName, setPrinterName] = useState("")
  const [creating, setCreating] = useState(false)

  const [tokenReveal, setTokenReveal] = useState<TokenReveal | null>(null)
  const [copied, setCopied] = useState(false)

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const response = await fetch("/api/admin/print-devices", {
        cache: "no-store",
      })
      const data = await readJson(response)

      if (!response.ok || !data?.success) {
        setLoadError(data?.error || "Não foi possível carregar os dispositivos.")
        return
      }

      setDevices(data.devices ?? [])
    } catch {
      setLoadError("Erro de conexão ao carregar os dispositivos.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  function closeTokenReveal() {
    setTokenReveal(null)
    setCopied(false)
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setCreating(true)

    try {
      const response = await fetch("/api/admin/print-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceName, printerName }),
      })
      const data = await readJson(response)

      if (!response.ok || !data?.success) {
        toast.error(data?.error || "Não foi possível cadastrar o dispositivo.")
        return
      }

      setCreateOpen(false)
      setDeviceName("")
      setPrinterName("")
      setTokenReveal({
        token: data.token,
        deviceName: data.device.device_name,
        reason: "created",
      })
      toast.success("Dispositivo cadastrado.")
      loadDevices()
    } catch {
      toast.error("Erro de conexão ao cadastrar o dispositivo.")
    } finally {
      setCreating(false)
    }
  }

  async function handleConfirmAction() {
    if (!pendingAction) return

    setActionBusy(true)

    try {
      const response = await fetch(
        `/api/admin/print-devices/${pendingAction.device.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: pendingAction.type }),
        },
      )
      const data = await readJson(response)

      if (!response.ok || !data?.success) {
        toast.error(data?.error || "Não foi possível concluir a ação.")
        return
      }

      setPendingAction(null)

      if (pendingAction.type === "rotate") {
        setTokenReveal({
          token: data.token,
          deviceName: data.device.device_name,
          reason: "rotated",
        })
        toast.success("Token substituído. O token anterior foi invalidado.")
      } else {
        toast.success("Dispositivo desativado. O histórico foi preservado.")
      }

      loadDevices()
    } catch {
      toast.error("Erro de conexão ao concluir a ação.")
    } finally {
      setActionBusy(false)
    }
  }

  async function copyToken() {
    if (!tokenReveal) return

    try {
      await navigator.clipboard.writeText(tokenReveal.token)
      setCopied(true)
      toast.success("Token copiado.")
    } catch {
      toast.error("Não foi possível copiar. Selecione o token e copie manualmente.")
    }
  }

  const activeCount = devices.filter((device) => device.is_active).length

  return (
    <AdminLayout
      title="Dispositivos de Impressão"
      description="Gerencie os computadores autorizados a imprimir comandas pelo ClickFood Desktop."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {loading
                  ? "Carregando dispositivos..."
                  : `${activeCount} de ${devices.length} dispositivo(s) ativo(s)`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada computador usa um token próprio. Mantenha o token em sigilo.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDevices}
              disabled={loading}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", loading && "animate-spin")}
              />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo dispositivo
            </Button>
          </div>
        </div>

        {loading && devices.length === 0 ? (
          <DeviceSkeleton />
        ) : loadError ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={loadDevices}>
              Tentar novamente
            </Button>
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <Monitor className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">
              Nenhum dispositivo cadastrado
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Cadastre o computador do caixa para gerar o token do ClickFood
              Desktop.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <article
                key={device.id}
                className={cn(
                  "flex flex-col rounded-xl border border-border bg-card p-5 transition-colors",
                  !device.is_active && "opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-foreground">
                      {device.device_name}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Printer className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {device.printer_name || "Impressora não informada"}
                      </span>
                    </p>
                  </div>
                  <DeviceStatus device={device} />
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Última conexão</dt>
                    <dd className="text-right text-foreground">
                      {formatDateTime(device.last_seen_at)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Cadastrado em</dt>
                    <dd className="text-right text-foreground">
                      {formatDateTime(device.created_at)}
                    </dd>
                  </div>
                </dl>

                {device.is_active && (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPendingAction({ type: "rotate", device })
                      }
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Substituir token
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setPendingAction({ type: "deactivate", device })
                      }
                    >
                      <Power className="mr-2 h-4 w-4" />
                      Desativar
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Cadastro de novo dispositivo */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!creating) setCreateOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Novo dispositivo</DialogTitle>
              <DialogDescription>
                Um token será gerado para este computador. Ele será exibido uma
                única vez.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="device-name">Nome do dispositivo</Label>
              <Input
                id="device-name"
                placeholder="Ex.: Computador do caixa"
                value={deviceName}
                maxLength={80}
                required
                minLength={2}
                onChange={(event) => setDeviceName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="printer-name">Impressora (opcional)</Label>
              <Input
                id="printer-name"
                placeholder="Ex.: Goldensky 58mm"
                value={printerName}
                maxLength={120}
                onChange={(event) => setPrinterName(event.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Gerando..." : "Gerar token"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Exibição única do token */}
      <Dialog
        open={tokenReveal !== null}
        onOpenChange={(open) => {
          if (!open) closeTokenReveal()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {tokenReveal?.reason === "rotated"
                ? "Novo token gerado"
                : "Token do dispositivo"}
            </DialogTitle>
            <DialogDescription>
              {tokenReveal?.deviceName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Este token não será exibido novamente. Copie agora e configure
                no ClickFood Desktop.
                {tokenReveal?.reason === "rotated" &&
                  " O token anterior já não funciona mais."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="token-value">Token</Label>
              <div className="flex gap-2">
                <Input
                  id="token-value"
                  readOnly
                  value={tokenReveal?.token ?? ""}
                  onFocus={(event) => event.target.select()}
                  className="font-mono text-xs"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyToken}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={closeTokenReveal}>
              Concluí, fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de substituição e desativação */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !actionBusy) setPendingAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "rotate"
                ? `Substituir token de "${pendingAction.device.device_name}"?`
                : `Desativar "${pendingAction?.device.device_name ?? ""}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {pendingAction?.type === "rotate" ? (
                <>
                  <span className="block">
                    O token atual será invalidado imediatamente. Se o Desktop
                    continuar com o token antigo, ele deixará de receber e
                    imprimir pedidos.
                  </span>
                  <span className="block">
                    Você precisará colar o novo token no ClickFood Desktop deste
                    computador.
                  </span>
                </>
              ) : (
                <span className="block">
                  Este computador deixará de receber pedidos para impressão. O
                  histórico de impressões é mantido. Não é possível reativar
                  este dispositivo pelo painel; para voltar a imprimir, cadastre
                  um novo dispositivo.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              onClick={(event) => {
                event.preventDefault()
                handleConfirmAction()
              }}
              className={cn(
                pendingAction?.type === "deactivate" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {actionBusy
                ? "Aguarde..."
                : pendingAction?.type === "rotate"
                  ? "Substituir token"
                  : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
