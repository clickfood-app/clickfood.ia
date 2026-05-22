"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgePercent,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type CampaignStatus = "active" | "scheduled" | "paused" | "finished";
type DiscountType = "fixed" | "percentage";
type SourceType = "clickfood" | "restaurant" | "mixed";

type PromoCampaignRow = {
  id: string;
  name: string | null;
  description: string | null;
  total_balance: number | string | null;
  used_balance: number | string | null;
  customers_impacted: number | string | null;
  orders_generated: number | string | null;
  status: string | null;
  valid_until: string | null;
  discount_type: string | null;
  discount_value: number | string | null;
  minimum_order: number | string | null;
  customer_usage_limit: number | string | null;
  source_type: string | null;
  created_at: string | null;
};

type PromoUsageRow = {
  id: string;
  campaign_id: string | null;
  order_id: string | null;
  customer_name: string | null;
  amount_used: number | string | null;
  order_total: number | string | null;
  created_at: string | null;
};

type PromoCampaign = {
  id: string;
  name: string;
  description: string;
  totalBalance: number;
  usedBalance: number;
  customersImpacted: number;
  ordersGenerated: number;
  status: CampaignStatus;
  validUntil: string | null;
  discountType: DiscountType;
  discountValue: number;
  minimumOrder: number;
  customerUsageLimit: number;
  sourceType: SourceType;
  createdAt: string | null;
};

type PromoUsage = {
  id: string;
  campaignId: string | null;
  campaignName: string;
  orderId: string | null;
  customerName: string;
  amountUsed: number;
  orderTotal: number;
  createdAt: string | null;
};

const statusMap: Record<
  CampaignStatus,
  {
    label: string;
    className: string;
  }
> = {
  active: {
    label: "Ativa",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  scheduled: {
    label: "Agendada",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  paused: {
    label: "Pausada",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  finished: {
    label: "Finalizada",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
};

const sourceMap: Record<
  SourceType,
  {
    label: string;
    className: string;
  }
> = {
  clickfood: {
    label: "ClickPromo automático",
    className: "bg-blue-50 text-blue-700 ring-blue-100",
  },
  restaurant: {
    label: "ClickPromo interno",
    className: "bg-blue-50 text-blue-700 ring-blue-100",
  },
  mixed: {
    label: "ClickPromo interno",
    className: "bg-blue-50 text-blue-700 ring-blue-100",
  },
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(status: string | null): CampaignStatus {
  if (
    status === "active" ||
    status === "scheduled" ||
    status === "paused" ||
    status === "finished"
  ) {
    return status;
  }

  return "active";
}

function normalizeDiscountType(type: string | null): DiscountType {
  return type === "percentage" ? "percentage" : "fixed";
}

function normalizeSourceType(source: string | null): SourceType {
  if (source === "clickfood" || source === "restaurant" || source === "mixed") {
    return source;
  }

  return "clickfood";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: string | null) {
  if (!date) return "Sem validade";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateTime(date: string | null) {
  if (!date) return "Agora";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getShortOrderId(orderId: string | null) {
  if (!orderId) return "Pedido";

  return `#${orderId.slice(0, 8).toUpperCase()}`;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  tone: "blue" | "emerald" | "orange" | "violet" | "cyan";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    orange: "bg-orange-50 text-orange-700 ring-orange-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  }[tone];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-2xl p-3 ring-1 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>

        <ArrowUpRight className="mt-1 h-4 w-4 text-slate-300" />
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
        {title}
      </p>

      <strong className="mt-1 block text-2xl font-black tracking-tight text-slate-950">
        {value}
      </strong>

      <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
        <Icon className="h-5 w-5" />
      </div>

      <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default function SaldoPromocionalPage() {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<PromoCampaign[]>([]);
  const [recentUsages, setRecentUsages] = useState<PromoUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const resolveRestaurant = useCallback(async () => {
    if (restaurantId) return restaurantId;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Usuário não autenticado.");
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (restaurantError || !restaurant?.id) {
      throw new Error("Restaurante não encontrado para este usuário.");
    }

    setRestaurantId(restaurant.id);
    return restaurant.id as string;
  }, [restaurantId, supabase]);

  const loadPromotionalBalance = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      try {
        if (silent) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setTableMissing(false);

        const currentRestaurantId = await resolveRestaurant();

        const { data: campaignsData, error: campaignsError } = await supabase
          .from("promotional_balance_campaigns")
          .select(
            `
              id,
              name,
              description,
              total_balance,
              used_balance,
              customers_impacted,
              orders_generated,
              status,
              valid_until,
              discount_type,
              discount_value,
              minimum_order,
              customer_usage_limit,
              source_type,
              created_at
            `,
          )
          .eq("restaurant_id", currentRestaurantId)
          .eq("source_type", "clickfood")
          .order("created_at", { ascending: false });

        if (campaignsError) {
          const message = campaignsError.message?.toLowerCase() ?? "";

          if (
            campaignsError.code === "42P01" ||
            campaignsError.code === "PGRST205" ||
            message.includes("could not find the table") ||
            message.includes("schema cache")
          ) {
            setCampaigns([]);
            setRecentUsages([]);
            setTableMissing(true);
            return;
          }

          throw campaignsError;
        }

        const mappedCampaigns = (
          (campaignsData ?? []) as PromoCampaignRow[]
        ).map((campaign) => ({
          id: campaign.id,
          name: campaign.name ?? "Campanha sem nome",
          description:
            campaign.description ??
            "Benefício automático ClickPromo liberado pela ClickFood para este restaurante.",
          totalBalance: toNumber(campaign.total_balance),
          usedBalance: toNumber(campaign.used_balance),
          customersImpacted: toNumber(campaign.customers_impacted),
          ordersGenerated: toNumber(campaign.orders_generated),
          status: normalizeStatus(campaign.status),
          validUntil: campaign.valid_until,
          discountType: normalizeDiscountType(campaign.discount_type),
          discountValue: toNumber(campaign.discount_value),
          minimumOrder: toNumber(campaign.minimum_order),
          customerUsageLimit: toNumber(campaign.customer_usage_limit),
          sourceType: normalizeSourceType(campaign.source_type),
          createdAt: campaign.created_at,
        }));

        setCampaigns(mappedCampaigns);

        const { data: usagesData, error: usagesError } = await supabase
          .from("promotional_balance_usages")
          .select(
            `
              id,
              campaign_id,
              order_id,
              customer_name,
              amount_used,
              order_total,
              created_at
            `,
          )
          .eq("restaurant_id", currentRestaurantId)
          .eq("source_type", "clickfood")
          .order("created_at", { ascending: false })
          .limit(6);

        if (usagesError) {
          const message = usagesError.message?.toLowerCase() ?? "";

          if (
            usagesError.code === "42P01" ||
            usagesError.code === "PGRST205" ||
            message.includes("could not find the table") ||
            message.includes("schema cache")
          ) {
            setRecentUsages([]);
            return;
          }

          throw usagesError;
        }

        const campaignNameById = new Map(
          mappedCampaigns.map((campaign) => [campaign.id, campaign.name]),
        );

        const mappedUsages = ((usagesData ?? []) as PromoUsageRow[]).map(
          (usage) => ({
            id: usage.id,
            campaignId: usage.campaign_id,
            campaignName: usage.campaign_id
              ? (campaignNameById.get(usage.campaign_id) ?? "ClickPromo")
              : "ClickPromo",
            orderId: usage.order_id,
            customerName: usage.customer_name ?? "Cliente",
            amountUsed: toNumber(usage.amount_used),
            orderTotal: toNumber(usage.order_total),
            createdAt: usage.created_at,
          }),
        );

        setRecentUsages(mappedUsages);
      } catch (error) {
        toast({
          title: "Erro ao carregar ClickPromo",
          description:
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os dados do ClickPromo.",
          variant: "destructive",
        });

        setCampaigns([]);
        setRecentUsages([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [resolveRestaurant, supabase, toast],
  );

  useEffect(() => {
    void loadPromotionalBalance();
  }, [loadPromotionalBalance]);

  const filteredCampaigns = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return campaigns;
    }

    return campaigns.filter((campaign) => {
      return (
        campaign.name.toLowerCase().includes(normalizedSearch) ||
        campaign.description.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [campaigns, search]);

  const summary = useMemo(() => {
    const totalBalance = campaigns.reduce(
      (acc, campaign) => acc + campaign.totalBalance,
      0,
    );

    const usedBalance = campaigns.reduce(
      (acc, campaign) => acc + campaign.usedBalance,
      0,
    );

    const availableBalance = totalBalance - usedBalance;

    const ordersGenerated = campaigns.reduce(
      (acc, campaign) => acc + campaign.ordersGenerated,
      0,
    );

    const customersImpacted = campaigns.reduce(
      (acc, campaign) => acc + campaign.customersImpacted,
      0,
    );

    const generatedRevenue = recentUsages.reduce(
      (acc, usage) => acc + usage.orderTotal,
      0,
    );

    const estimatedReturn =
      usedBalance > 0 ? generatedRevenue / usedBalance : 0;

    const clickfoodBalance = campaigns
      .filter((campaign) => campaign.sourceType === "clickfood")
      .reduce((acc, campaign) => acc + campaign.totalBalance, 0);

    const restaurantBalance = campaigns
      .filter((campaign) => campaign.sourceType === "restaurant")
      .reduce((acc, campaign) => acc + campaign.totalBalance, 0);

    const mixedBalance = campaigns
      .filter((campaign) => campaign.sourceType === "mixed")
      .reduce((acc, campaign) => acc + campaign.totalBalance, 0);

    return {
      totalBalance,
      usedBalance,
      availableBalance,
      ordersGenerated,
      customersImpacted,
      generatedRevenue,
      estimatedReturn,
      clickfoodBalance,
      restaurantBalance,
      mixedBalance,
    };
  }, [campaigns, recentUsages]);

  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "active",
  ).length;

  return (
    <AdminLayout title="ClickPromo">
      <div className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 ring-1 ring-blue-100">
                <Sparkles className="h-3.5 w-3.5" />
                Benefício automático
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-950">
                ClickPromo
              </h1>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Acompanhe os benefícios automáticos liberados pela ClickFood no
                checkout, sem cupom digitável e sem ação manual do cliente.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void loadPromotionalBalance({ silent: true })}
                disabled={isRefreshing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Atualizar
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Crédito ClickPromo"
            value={formatCurrency(summary.totalBalance)}
            subtitle="Total liberado pela ClickFood"
            icon={Wallet}
            tone="blue"
          />

          <MetricCard
            title="Disponível"
            value={formatCurrency(summary.availableBalance)}
            subtitle="Crédito restante para clientes"
            icon={CheckCircle2}
            tone="emerald"
          />

          <MetricCard
            title="Usado em pedidos"
            value={formatCurrency(summary.usedBalance)}
            subtitle="Desconto automático aplicado"
            icon={BadgePercent}
            tone="orange"
          />

          <MetricCard
            title="Pedidos com ClickPromo"
            value={String(summary.ordersGenerated)}
            subtitle={`${activeCampaigns} ação(ões) ativa(s)`}
            icon={TrendingUp}
            tone="violet"
          />

          <MetricCard
            title="Clientes beneficiados"
            value={String(summary.customersImpacted)}
            subtitle="Clientes que receberam benefício"
            icon={Users}
            tone="cyan"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Ações ClickPromo
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Acompanhe crédito liberado, uso automático e retorno de cada
                  ação.
                </p>
              </div>

              <div className="relative w-full lg:max-w-xs">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar ação..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="mt-5">
              {isLoading ? (
                <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 px-5 py-16 text-sm font-bold text-slate-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
                  Carregando ClickPromo...
                </div>
              ) : tableMissing ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="Estrutura do ClickPromo ainda não criada"
                  description="A tela já está dentro do painel. Agora falta criar as tabelas no Supabase para salvar ações, usos e histórico real."
                />
              ) : filteredCampaigns.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Nenhuma ação ClickPromo ativa"
                  description="Quando a ClickFood liberar uma ação automática para este restaurante, ela aparecerá aqui com crédito, regras e resultados."
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredCampaigns.map((campaign) => {
                    const availableBalance =
                      campaign.totalBalance - campaign.usedBalance;

                    const usagePercentage =
                      campaign.totalBalance > 0
                        ? Math.min(
                            (campaign.usedBalance / campaign.totalBalance) *
                              100,
                            100,
                          )
                        : 0;

                    const campaignRevenue = recentUsages
                      .filter((usage) => usage.campaignId === campaign.id)
                      .reduce((acc, usage) => acc + usage.orderTotal, 0);

                    const campaignReturn =
                      campaign.usedBalance > 0
                        ? campaignRevenue / campaign.usedBalance
                        : 0;

                    const status = statusMap[campaign.status];
                    const source = sourceMap[campaign.sourceType];

                    return (
                      <article
                        key={campaign.id}
                        className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${status.className}`}
                              >
                                {status.label}
                              </span>

                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Até {formatDate(campaign.validUntil)}
                              </span>

                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1 ${source.className}`}
                              >
                                {source.label}
                              </span>
                            </div>

                            <h3 className="mt-3 text-lg font-black text-slate-950">
                              {campaign.name}
                            </h3>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              {campaign.description}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-blue-700">
                            <p className="text-xs font-black uppercase tracking-wide text-blue-500">
                              Benefício
                            </p>

                            <strong className="mt-1 block text-xl font-black">
                              {campaign.discountType === "fixed"
                                ? formatCurrency(campaign.discountValue)
                                : `${campaign.discountValue}%`}
                            </strong>
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-600">
                              Uso do ClickPromo
                            </span>

                            <span className="font-black text-slate-950">
                              {usagePercentage.toFixed(0)}%
                            </span>
                          </div>

                          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-orange-500"
                              style={{ width: `${usagePercentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-bold text-slate-500">
                              Crédito liberado
                            </p>

                            <strong className="mt-1 block text-base font-black text-slate-950">
                              {formatCurrency(campaign.totalBalance)}
                            </strong>
                          </div>

                          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-bold text-slate-500">
                              Crédito usado
                            </p>

                            <strong className="mt-1 block text-base font-black text-orange-600">
                              {formatCurrency(campaign.usedBalance)}
                            </strong>
                          </div>

                          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-bold text-slate-500">
                              Disponível
                            </p>

                            <strong className="mt-1 block text-base font-black text-emerald-600">
                              {formatCurrency(availableBalance)}
                            </strong>
                          </div>

                          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-bold text-slate-500">
                              Retorno estimado
                            </p>

                            <strong className="mt-1 block text-base font-black text-slate-950">
                              {campaignReturn > 0
                                ? `${campaignReturn.toFixed(1)}x`
                                : "-"}
                            </strong>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Pedido mínimo
                            </p>

                            <p className="mt-1 text-sm font-black text-slate-800">
                              {campaign.minimumOrder > 0
                                ? formatCurrency(campaign.minimumOrder)
                                : "Sem mínimo"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Limite por cliente
                            </p>

                            <p className="mt-1 text-sm font-black text-slate-800">
                              {campaign.customerUsageLimit > 0
                                ? `${campaign.customerUsageLimit} uso(s)`
                                : "Sem limite"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Pedidos gerados
                            </p>

                            <p className="mt-1 text-sm font-black text-slate-800">
                              {campaign.ordersGenerated}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 ring-1 ring-blue-100">
                  <BarChart3 className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Crédito ClickPromo
                  </h2>

                  <p className="text-sm text-slate-500">
                    Benefício liberado pela ClickFood
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                  <span className="text-sm font-black text-blue-700">
                    Liberado
                  </span>

                  <strong className="text-sm font-black text-blue-900">
                    {formatCurrency(summary.totalBalance)}
                  </strong>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3 ring-1 ring-orange-100">
                  <span className="text-sm font-black text-orange-700">
                    Usado
                  </span>

                  <strong className="text-sm font-black text-orange-900">
                    {formatCurrency(summary.usedBalance)}
                  </strong>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                  <span className="text-sm font-black text-emerald-700">
                    Disponível
                  </span>

                  <strong className="text-sm font-black text-emerald-900">
                    {formatCurrency(summary.availableBalance)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 ring-1 ring-emerald-100">
                  <Target className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Inteligência
                  </h2>

                  <p className="text-sm text-slate-500">
                    Resultado estimado das ações
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Faturamento gerado
                  </p>

                  <strong className="mt-1 block text-xl font-black text-slate-950">
                    {formatCurrency(summary.generatedRevenue)}
                  </strong>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Retorno estimado
                  </p>

                  <strong className="mt-1 block text-xl font-black text-emerald-700">
                    {summary.estimatedReturn > 0
                      ? `${summary.estimatedReturn.toFixed(1)}x`
                      : "-"}
                  </strong>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Melhor uso
                  </p>

                  <strong className="mt-1 block text-sm font-black text-slate-800">
                    {campaigns.length > 0
                      ? "Aplicação automática no checkout"
                      : "Aguardando ações ClickPromo"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-50 p-3 text-orange-700 ring-1 ring-orange-100">
                  <Clock className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Histórico recente
                  </h2>

                  <p className="text-sm text-slate-500">
                    Últimos usos do ClickPromo
                  </p>
                </div>
              </div>

              <div className="mt-5">
                {recentUsages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
                    Nenhum uso registrado ainda. Quando o ClickPromo for
                    aplicado automaticamente no checkout, ele aparecerá aqui.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentUsages.map((usage) => (
                      <div
                        key={usage.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-950">
                              {usage.customerName}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {usage.campaignName} •{" "}
                              {getShortOrderId(usage.orderId)}
                            </p>
                          </div>

                          <strong className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700 ring-1 ring-orange-100">
                            -{formatCurrency(usage.amountUsed)}
                          </strong>
                        </div>

                        <p className="mt-3 text-xs font-semibold text-slate-400">
                          {formatDateTime(usage.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AdminLayout>
  );
}
