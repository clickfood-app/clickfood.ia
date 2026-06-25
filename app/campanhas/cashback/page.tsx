"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  Gift,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  WalletCards,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type CashbackWallet = {
  id: string
  restaurant_id: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string
  balance: number
  total_earned: number
  total_redeemed: number
  created_at: string
  updated_at: string
}

type CashbackTransaction = {
  id: string
  restaurant_id: string
  wallet_id: string
  customer_id: string | null
  order_id: string | null
  campaign_id: string | null
  type: string
  amount: number
  description: string | null
  expires_at: string | null
  created_at: string
}

type CashbackCampaignForm = {
  enabled: boolean
  campaignName: string
  earnMinimumOrder: string
  cashbackAmount: string
  redeemMinimumOrder: string
  validityDays: string
  budgetLimit: string
}

type TransactionType = "credit" | "debit" | "expired"

const transactionDescriptions: Record<TransactionType, string> = {
  credit: "Crédito manual de cashback",
  debit: "Uso manual de cashback",
  expired: "Expiração manual de cashback",
}

const defaultCampaignForm: CashbackCampaignForm = {
  enabled: false,
  campaignName: "Cashback automático",
  earnMinimumOrder: "50",
  cashbackAmount: "5",
  redeemMinimumOrder: "40",
  validityDays: "30",
  budgetLimit: "",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0)
}

function formatDate(value: string | null) {
  if (!value) return "Sem validade"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "")
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toInputNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? String(parsed) : String(fallback)
}

function firstDefined(source: Record<string, any>, keys: string[], fallback: unknown) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key]
    }
  }

  return fallback
}

function cleanPayload(payload: Record<string, any>) {
  return Object.entries(payload).reduce<Record<string, any>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value
    }

    return acc
  }, {})
}

export default function CashbackPage() {
  const supabase = createClient()

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaignForm, setCampaignForm] = useState<CashbackCampaignForm>(defaultCampaignForm)
  const [wallets, setWallets] = useState<CashbackWallet[]>([])
  const [transactions, setTransactions] = useState<CashbackTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [search, setSearch] = useState("")

  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [type, setType] = useState<TransactionType>("credit")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [expiresAt, setExpiresAt] = useState("")

  const campaignNumbers = useMemo(() => {
    return {
      earnMinimumOrder: toNumber(campaignForm.earnMinimumOrder),
      cashbackAmount: toNumber(campaignForm.cashbackAmount),
      redeemMinimumOrder: toNumber(campaignForm.redeemMinimumOrder),
      validityDays: toNumber(campaignForm.validityDays),
      budgetLimit: campaignForm.budgetLimit ? toNumber(campaignForm.budgetLimit) : 0,
    }
  }, [campaignForm])

  const filteredWallets = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return wallets

    return wallets.filter((wallet) => {
      const name = wallet.customer_name?.toLowerCase() || ""
      const phone = wallet.customer_phone.toLowerCase()

      return name.includes(term) || phone.includes(term)
    })
  }, [search, wallets])

  const walletById = useMemo(() => {
    return wallets.reduce<Record<string, CashbackWallet>>((acc, wallet) => {
      acc[wallet.id] = wallet
      return acc
    }, {})
  }, [wallets])

  const selectedWallet = useMemo(() => {
    const normalizedPhone = normalizePhone(customerPhone)

    if (!normalizedPhone) return null

    return wallets.find((wallet) => wallet.customer_phone === normalizedPhone) || null
  }, [customerPhone, wallets])

  const totals = useMemo(() => {
    return wallets.reduce(
      (acc, wallet) => {
        acc.balance += toNumber(wallet.balance)
        acc.totalEarned += toNumber(wallet.total_earned)
        acc.totalRedeemed += toNumber(wallet.total_redeemed)

        if (toNumber(wallet.balance) > 0) {
          acc.activeWallets += 1
        }

        return acc
      },
      {
        balance: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        activeWallets: 0,
      },
    )
  }, [wallets])

  const averageCashbackRate = useMemo(() => {
    if (!campaignNumbers.earnMinimumOrder || !campaignNumbers.cashbackAmount) {
      return 0
    }

    return (campaignNumbers.cashbackAmount / campaignNumbers.earnMinimumOrder) * 100
  }, [campaignNumbers.cashbackAmount, campaignNumbers.earnMinimumOrder])

  async function loadData() {
    try {
      setLoading(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("Usuário não autenticado.")
      }

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError || !restaurant) {
        throw new Error("Restaurante não encontrado.")
      }

      setRestaurantId(restaurant.id)

      const [campaignResponse, walletsResponse, transactionsResponse] = await Promise.all([
        supabase
          .from("campaigns")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .eq("campaign_type", "cashback")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("cashback_wallets")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("updated_at", { ascending: false }),

        supabase
          .from("cashback_transactions")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })
          .limit(60),
      ])

      if (campaignResponse.error) {
        throw campaignResponse.error
      }

      if (walletsResponse.error) {
        throw walletsResponse.error
      }

      if (transactionsResponse.error) {
        throw transactionsResponse.error
      }

      const campaign = (campaignResponse.data || null) as Record<string, any> | null

      if (campaign) {
        const settings = (campaign.settings || campaign.rules || {}) as Record<string, any>
const targetConfig = (campaign.target_config || campaign.targetConfig || {}) as Record<string, any>
const rewardConfig = (campaign.reward_config || campaign.rewardConfig || {}) as Record<string, any>

const mergedCampaign = {
  ...settings,
  ...targetConfig,
  ...rewardConfig,
  ...campaign,
}

        setCampaignId(campaign.id || null)
        setCampaignForm({
          enabled:
            campaign.is_active === true ||
            campaign.active === true ||
            campaign.status === "active" ||
            campaign.status === "enabled",
          campaignName: String(
            firstDefined(
              mergedCampaign,
              ["campaign_name", "name", "title"],
              defaultCampaignForm.campaignName,
            ),
          ),
          earnMinimumOrder: toInputNumber(
            firstDefined(
              mergedCampaign,
              [
                "earn_minimum_order_amount",
                "earn_minimum_order",
                "min_order_to_earn",
                "minimum_order_to_earn",
                "minimum_order",
                "minimum_order_value",
                "min_order_value",
              ],
              defaultCampaignForm.earnMinimumOrder,
            ),
            Number(defaultCampaignForm.earnMinimumOrder),
          ),
          cashbackAmount: toInputNumber(
            firstDefined(
              mergedCampaign,
              [
                "cashback_amount",
                "cashback_value",
                "reward_value",
                "discount_value",
                "value",
              ],
              defaultCampaignForm.cashbackAmount,
            ),
            Number(defaultCampaignForm.cashbackAmount),
          ),
          redeemMinimumOrder: toInputNumber(
            firstDefined(
              mergedCampaign,
              [
                "redeem_minimum_order_amount",
                "redeem_minimum_order",
                "minimum_order_to_redeem",
                "min_order_to_redeem",
                "redeem_min_order",
              ],
              defaultCampaignForm.redeemMinimumOrder,
            ),
            Number(defaultCampaignForm.redeemMinimumOrder),
          ),
          validityDays: toInputNumber(
            firstDefined(
              mergedCampaign,
              ["validity_days", "cashback_validity_days", "expires_in_days"],
              defaultCampaignForm.validityDays,
            ),
            Number(defaultCampaignForm.validityDays),
          ),
          budgetLimit:
            firstDefined(mergedCampaign, ["budget_limit", "max_budget"], "") === ""
              ? ""
              : toInputNumber(firstDefined(mergedCampaign, ["budget_limit", "max_budget"], ""), 0),
        })
      } else {
        setCampaignId(null)
        setCampaignForm(defaultCampaignForm)
      }

      setWallets(
        (walletsResponse.data || []).map((wallet) => ({
          ...wallet,
          balance: toNumber(wallet.balance),
          total_earned: toNumber(wallet.total_earned),
          total_redeemed: toNumber(wallet.total_redeemed),
        })),
      )

      setTransactions(
        (transactionsResponse.data || []).map((transaction) => ({
          ...transaction,
          amount: toNumber(transaction.amount),
        })),
      )
    } catch (error) {
      console.error(error)
      alert("Não foi possível carregar o cashback.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateCampaignField(field: keyof CashbackCampaignForm, value: string | boolean) {
    setCampaignForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function buildCampaignPayloads(nextEnabled: boolean) {
  const status = nextEnabled ? "active" : "paused"
  const campaignName = campaignForm.campaignName.trim() || "Cashback automático"
  const budgetLimit = campaignForm.budgetLimit ? campaignNumbers.budgetLimit : null
  const now = new Date().toISOString()

  return [
    cleanPayload({
      restaurant_id: restaurantId,
      name: campaignName,
      description: `Cliente ganha ${formatCurrency(
        campaignNumbers.cashbackAmount
      )} de cashback em pedidos acima de ${formatCurrency(
        campaignNumbers.earnMinimumOrder
      )} e pode usar em pedidos acima de ${formatCurrency(
        campaignNumbers.redeemMinimumOrder
      )}.`,
      campaign_type: "cashback",
      status,
      audience_type: "all_customers",
      target_config: {
        earn_minimum_order_amount: campaignNumbers.earnMinimumOrder,
        redeem_minimum_order_amount: campaignNumbers.redeemMinimumOrder,
      },
      reward_config: {
        cashback_amount: campaignNumbers.cashbackAmount,
        cashback_type: "fixed",
        redeem_amount: campaignNumbers.cashbackAmount,
        validity_days: campaignNumbers.validityDays,
      },
      minimum_order_amount: campaignNumbers.earnMinimumOrder,
      budget_limit: budgetLimit,
      used_budget: 0,
      usage_limit_total: 999999,
      usage_limit_per_customer: 999999,
      updated_at: now,
    }),
  ]
}

  async function persistCampaign(nextEnabled: boolean) {
    if (!restaurantId) {
      alert("Restaurante não encontrado.")
      return false
    }

    if (campaignNumbers.earnMinimumOrder <= 0) {
      alert("Informe o valor mínimo para ganhar cashback.")
      return false
    }

    if (campaignNumbers.cashbackAmount <= 0) {
      alert("Informe o valor do cashback gerado.")
      return false
    }

    if (campaignNumbers.redeemMinimumOrder <= 0) {
      alert("Informe o valor mínimo para usar cashback.")
      return false
    }

    if (campaignNumbers.validityDays <= 0) {
      alert("Informe a validade do cashback em dias.")
      return false
    }

    const payloads = buildCampaignPayloads(nextEnabled)
    let lastError: unknown = null

    for (const payload of payloads) {
      try {
        if (campaignId) {
          const { error } = await supabase
            .from("campaigns")
            .update(payload)
            .eq("id", campaignId)

          if (error) {
            lastError = error
            continue
          }

          return true
        }

        const { data, error } = await supabase
          .from("campaigns")
          .insert(payload)
          .select("id")
          .single()

        if (error) {
          lastError = error
          continue
        }

        setCampaignId(data?.id || null)
        return true
      } catch (error) {
        lastError = error
      }
    }

    console.error(lastError)
    alert("Não foi possível salvar a campanha de cashback.")
    return false
  }

  async function handleSaveCampaign(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    try {
      setSavingCampaign(true)
      const saved = await persistCampaign(campaignForm.enabled)

      if (saved) {
        await loadData()
      }
    } finally {
      setSavingCampaign(false)
    }
  }

  async function handleToggleCampaign() {
    const nextEnabled = !campaignForm.enabled

    try {
      setSavingCampaign(true)
      const saved = await persistCampaign(nextEnabled)

      if (saved) {
        setCampaignForm((current) => ({
          ...current,
          enabled: nextEnabled,
        }))
        await loadData()
      }
    } finally {
      setSavingCampaign(false)
    }
  }

  function fillWallet(wallet: CashbackWallet) {
    setCustomerName(wallet.customer_name || "")
    setCustomerPhone(wallet.customer_phone)

    if (type === "debit" || type === "expired") {
      setAmount(String(toNumber(wallet.balance)))
    }
  }

  function clearForm() {
    setCustomerName("")
    setCustomerPhone("")
    setType("credit")
    setAmount("")
    setDescription("")
    setExpiresAt("")
  }

  function handleTypeChange(nextType: TransactionType) {
    setType(nextType)

    if ((nextType === "debit" || nextType === "expired") && selectedWallet) {
      setAmount(String(toNumber(selectedWallet.balance)))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      alert("Restaurante não encontrado.")
      return
    }

    const normalizedPhone = normalizePhone(customerPhone)
    const parsedAmount = Number(amount)

    if (!normalizedPhone) {
      alert("Informe o telefone do cliente.")
      return
    }

    if (!parsedAmount || parsedAmount <= 0) {
      alert("Informe um valor válido.")
      return
    }

    try {
      setSaving(true)

      const { data: existingWallet, error: walletSearchError } = await supabase
        .from("cashback_wallets")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("customer_phone", normalizedPhone)
        .maybeSingle()

      if (walletSearchError) {
        throw walletSearchError
      }

      if (!existingWallet && type !== "credit") {
        alert("Esse cliente ainda não tem carteira de cashback.")
        return
      }

      let wallet = existingWallet as CashbackWallet | null

      if (!wallet) {
        const { data: createdWallet, error: createWalletError } = await supabase
          .from("cashback_wallets")
          .insert({
            restaurant_id: restaurantId,
            customer_name: customerName.trim() || null,
            customer_phone: normalizedPhone,
            balance: 0,
            total_earned: 0,
            total_redeemed: 0,
          })
          .select("*")
          .single()

        if (createWalletError) {
          throw createWalletError
        }

        wallet = createdWallet as CashbackWallet
      }

      const currentBalance = toNumber(wallet.balance)
      const currentEarned = toNumber(wallet.total_earned)
      const currentRedeemed = toNumber(wallet.total_redeemed)

      if ((type === "debit" || type === "expired") && parsedAmount > currentBalance) {
        alert("O valor informado é maior que o saldo disponível do cliente.")
        return
      }

      const nextBalance =
        type === "credit"
          ? currentBalance + parsedAmount
          : currentBalance - parsedAmount

      const nextTotalEarned =
        type === "credit" ? currentEarned + parsedAmount : currentEarned

      const nextTotalRedeemed =
        type === "debit" ? currentRedeemed + parsedAmount : currentRedeemed

      const { error: updateWalletError } = await supabase
        .from("cashback_wallets")
        .update({
          customer_name: customerName.trim() || wallet.customer_name || null,
          balance: nextBalance,
          total_earned: nextTotalEarned,
          total_redeemed: nextTotalRedeemed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id)

      if (updateWalletError) {
        throw updateWalletError
      }

      const { error: createTransactionError } = await supabase
        .from("cashback_transactions")
        .insert({
          restaurant_id: restaurantId,
          wallet_id: wallet.id,
          customer_id: wallet.customer_id,
          campaign_id: campaignId,
          type,
          amount: parsedAmount,
          description:
            description.trim() ||
            transactionDescriptions[type],
          expires_at:
            type === "credit" && expiresAt
              ? new Date(expiresAt).toISOString()
              : null,
        })

      if (createTransactionError) {
        throw createTransactionError
      }

      clearForm()
      await loadData()
    } catch (error) {
      console.error(error)
      alert("Não foi possível salvar a movimentação.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
              <WalletCards className="h-5 w-5" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-white">
                  Cashback
                </h1>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    campaignForm.enabled
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-[#111111] text-zinc-500",
                  )}
                >
                  {campaignForm.enabled ? "Ativo" : "Pausado"}
                </span>
              </div>
              <p className="text-sm text-zinc-500">
                Configure cashback para trazer o cliente de volta sem complicar o checkout.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant={campaignForm.enabled ? "outline" : "default"}
              onClick={handleToggleCampaign}
              disabled={loading || savingCampaign}
              className="h-10 gap-2"
            >
              {savingCampaign ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : campaignForm.enabled ? (
                <PauseCircle className="h-4 w-4" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {campaignForm.enabled ? "Pausar" : "Ativar"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={loadData}
              disabled={loading}
              className="h-10 gap-2"
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        <form
          onSubmit={handleSaveCampaign}
          className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm"
        >
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111111] text-zinc-500">
                <SlidersHorizontal className="h-4 w-4" />
              </div>

              <div>
                <h2 className="font-semibold text-white">
                  Regras da campanha
                </h2>
                <p className="text-sm text-zinc-500">
                  O cliente usa o cashback inteiro ou não usa. Sem valor parcial.
                </p>
              </div>
            </div>

            <Button type="submit" disabled={savingCampaign} className="h-10 gap-2 lg:min-w-40">
              {savingCampaign ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar regras
            </Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-lg border border-white/10 bg-[#111111] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Regra atual
              </p>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Compra acima de <strong className="text-white">{formatCurrency(campaignNumbers.earnMinimumOrder)}</strong> ganha <strong className="text-emerald-400">{formatCurrency(campaignNumbers.cashbackAmount)}</strong>. Para usar, o próximo pedido precisa ser acima de <strong className="text-white">{formatCurrency(campaignNumbers.redeemMinimumOrder)}</strong>.
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-white/10 bg-[#0A0A0A] p-2">
                  <p className="text-[11px] text-zinc-500">Uso</p>
                  <strong className="text-xs text-white">Tudo ou nada</strong>
                </div>

                <div className="rounded-md border border-white/10 bg-[#0A0A0A] p-2">
                  <p className="text-[11px] text-zinc-500">Limite</p>
                  <strong className="text-xs text-white">1x por cliente</strong>
                </div>

                <div className="rounded-md border border-white/10 bg-[#0A0A0A] p-2">
                  <p className="text-[11px] text-zinc-500">Retorno</p>
                  <strong className="text-xs text-white">
                    {averageCashbackRate.toFixed(1).replace(".", ",")}%
                  </strong>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Nome interno</Label>
                <Input
                  value={campaignForm.campaignName}
                  onChange={(event) => updateCampaignField("campaignName", event.target.value)}
                  placeholder="Ex: Cashback de retorno"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Compra mínima</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={campaignForm.earnMinimumOrder}
                  onChange={(event) => updateCampaignField("earnMinimumOrder", event.target.value)}
                  placeholder="50.00"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Cashback gerado</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={campaignForm.cashbackAmount}
                  onChange={(event) => updateCampaignField("cashbackAmount", event.target.value)}
                  placeholder="5.00"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Mínima para uso</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={campaignForm.redeemMinimumOrder}
                  onChange={(event) => updateCampaignField("redeemMinimumOrder", event.target.value)}
                  placeholder="40.00"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Validade em dias</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={campaignForm.validityDays}
                  onChange={(event) => updateCampaignField("validityDays", event.target.value)}
                  placeholder="30"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Orçamento máximo</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={campaignForm.budgetLimit}
                  onChange={(event) => updateCampaignField("budgetLimit", event.target.value)}
                  placeholder="Opcional. Ex: 300.00"
                />
              </div>

              <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-400 md:col-span-2">
                <strong>Regra fixa:</strong> se o cliente usar cashback no pedido, ele não escolhe valor parcial.
              </div>
            </div>
          </div>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <WalletCards className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Saldo disponível</p>
              <strong className="text-xl font-semibold text-white">
                {formatCurrency(totals.balance)}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Clientes com saldo</p>
              <strong className="text-xl font-semibold text-white">
                {totals.activeWallets}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Total gerado</p>
              <strong className="text-xl font-semibold text-emerald-400">
                {formatCurrency(totals.totalEarned)}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Total utilizado</p>
              <strong className="text-xl font-semibold text-yellow-400">
                {formatCurrency(totals.totalRedeemed)}
              </strong>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-semibold text-white">
                    Carteiras de clientes
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Clientes com saldo disponível para próximas compras.
                  </p>
                </div>

                <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar cliente..."
                    className="pl-9"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando cashback...
                </div>
              ) : filteredWallets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 p-8 text-center">
                  <WalletCards className="mx-auto h-8 w-8 text-zinc-500" />
                  <p className="mt-2 font-medium text-white">
                    Nenhuma carteira encontrada
                  </p>
                  <p className="text-sm text-zinc-500">
                    Quando um cliente ganhar cashback, ele aparecerá aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="hidden rounded-lg bg-[#111111] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_120px] md:items-center md:gap-3">
                    <span>Cliente</span>
                    <span>Saldo</span>
                    <span>Gerado</span>
                    <span>Usado</span>
                    <span className="text-right">Ação</span>
                  </div>

                  {filteredWallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="grid gap-3 rounded-lg border border-white/10 bg-[#0A0A0A] p-3 text-sm transition hover:bg-[#111111] md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_120px] md:items-center"
                    >
                      <div>
                        <p className="font-semibold text-white">
                          {wallet.customer_name || "Cliente sem nome"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {wallet.customer_phone} • atualizado {formatDate(wallet.updated_at)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-500 md:hidden">Saldo</p>
                        <strong className="text-emerald-400">
                          {formatCurrency(wallet.balance)}
                        </strong>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-500 md:hidden">Gerado</p>
                        <span className="text-zinc-500">
                          {formatCurrency(wallet.total_earned)}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-500 md:hidden">Usado</p>
                        <span className="text-zinc-500">
                          {formatCurrency(wallet.total_redeemed)}
                        </span>
                      </div>

                      <div className="md:text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => fillWallet(wallet)}
                        >
                          Ajustar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="font-semibold text-white">
                  Histórico recente
                </h2>
                <p className="text-sm text-zinc-500">
                  Entradas, usos e expirações de cashback.
                </p>
              </div>

              {transactions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 p-8 text-center">
                  <CalendarClock className="mx-auto h-8 w-8 text-zinc-500" />
                  <p className="mt-2 font-medium text-white">
                    Nenhuma movimentação ainda
                  </p>
                  <p className="text-sm text-zinc-500">
                    O histórico aparecerá após o primeiro crédito, uso ou expiração.
                  </p>
                </div>
              ) : (
                <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                  {transactions.map((transaction) => {
                    const wallet = walletById[transaction.wallet_id]
                    const isCredit = transaction.type === "credit"

                    return (
                      <div
                        key={transaction.id}
                        className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#111111] p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              isCredit
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-yellow-400/10 text-yellow-400",
                            )}
                          >
                            {isCredit ? (
                              <ArrowUpCircle className="h-4 w-4" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4" />
                            )}
                          </div>

                          <div>
                            <p className="font-medium text-white">
                              {wallet?.customer_name || "Cliente sem nome"}
                            </p>
                            <p className="text-sm text-zinc-500">
                              {transaction.description || "Movimentação de cashback"}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {formatDate(transaction.created_at)}
                              {transaction.expires_at
                                ? ` • Expira em ${formatDate(transaction.expires_at)}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <div className="text-left md:text-right">
                          <p
                            className={cn(
                              "font-semibold",
                              isCredit ? "text-emerald-400" : "text-yellow-400",
                            )}
                          >
                            {isCredit ? "+" : "-"}
                            {formatCurrency(transaction.amount)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {transaction.type === "credit"
                              ? "Crédito"
                              : transaction.type === "expired"
                                ? "Expirado"
                                : "Utilizado"}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm xl:sticky xl:top-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111111] text-zinc-500">
                  <Plus className="h-4 w-4" />
                </div>

                <div>
                  <h2 className="font-semibold text-white">
                    Ajuste manual
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Use apenas para correções.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome do cliente</Label>
                  <Input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Ex: João Silva"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="Ex: 11999999999"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <select
                    value={type}
                    onChange={(event) => handleTypeChange(event.target.value as TransactionType)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="credit">Adicionar crédito</option>
                    <option value="debit">Usar / debitar saldo</option>
                    <option value="expired">Expirar saldo</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Valor</Label>
                    {selectedWallet && (type === "debit" || type === "expired") && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(toNumber(selectedWallet.balance)))}
                        className="text-xs font-medium text-yellow-400 hover:text-yellow-400"
                      >
                        Usar saldo todo
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Ex: 10.00"
                    required
                  />
                </div>

                {type === "credit" && (
                  <div className="space-y-1.5">
                    <Label>Validade do crédito</Label>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(event) => setExpiresAt(event.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex: Ajuste manual de campanha"
                    rows={3}
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full gap-2">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <WalletCards className="h-4 w-4" />
                  )}
                  Salvar ajuste
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
