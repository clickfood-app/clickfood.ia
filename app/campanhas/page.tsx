"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  BarChart3,
  ChevronRight,
  Clock3,
  Coins,
  Gift,
  Loader2,
  Megaphone,
  MessageSquare,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  UsersRound,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import AdminLayout from "@/components/admin-layout";
import { createClient } from "@/lib/supabase/client";

type RecentCampaign = {
  id: string;
  name: string;
  description: string;
  type: string;
  impact: string;
  secondaryImpact: string;
  status: string;
  period: string;
  createdAt: string;
};

type CampaignOverview = {
  success: boolean;
  message?: string;
  restaurant?: {
    id: string;
    name: string;
    slug: string;
  };
  summary: {
    activeCampaigns: number;
    fidelizedCustomers: number;
    monthlyRedemptions: number;
  };
  cardFidelidade: {
    hasCampaign: boolean;
    campaignId: string;
    title: string;
    rewardTitle: string;
    requiredOrders: number;
    isActive: boolean;
    participants: number;
    pendingRewards: number;
    redeemedRewards: number;
    completedGoals: number;
    progress: number;
    customersCloseToComplete: number;
  };
  insights: {
    customersCloseToComplete: number;
    inactiveCustomers: number;
  };
  recentCampaigns: RecentCampaign[];
  totals: {
    orders: number;
    monthOrders: number;
    paidOrDeliveredOrders: number;
    revenue: number;
  };
};

type CampaignReview = {
  id: string;
  customerName: string;
  customerPhone: string;
  rating: number;
  comment: string;
  orderId: string;
  orderNumber: string;
  createdAt: string;
  source: string;
};

type CampaignRevenueMetrics = {
  loyaltyRevenue: number;
  loyaltyOrders: number;
  cashbackRevenue: number;
  cashbackOrders: number;
  cashbackGenerated: number;
  cashbackUsed: number;
  upsellRevenue: number;
  upsellSales: number;
  smartCampaignRevenue: number;
  smartCampaignOrders: number;
};

type CampaignRevenueItem = {
  title: string;
  description: string;
  revenue: number;
  detail: string;
  href: string;
  tone: Tone;
};

type ReviewFilter = "all" | "positive" | "attention";
type RawRecord = Record<string, unknown>;
type Tone = "blue" | "orange" | "green" | "purple" | "slate";
type StatusTone = "active" | "warning" | "neutral" | "info";

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function formatRating(value: number) {
  if (!value) {
    return "0,0";
  }

  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatDateTime(value: string) {
  if (!value) {
    return "Data não informada";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function maskPhone(value: string) {
  const numbers = value.replace(/\D/g, "");

  if (numbers.length < 4) {
    return value || "Telefone não informado";
  }

  return `•••• ${numbers.slice(-4)}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return "C";
  }

  return parts
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getStatusClasses(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("ativa")) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (normalized.includes("conclu")) {
    return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }

  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
}

function getText(record: RawRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function getNumber(record: RawRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function normalizeReview(
  record: RawRecord,
  source: string,
): CampaignReview | null {
  const rating = getNumber(record, [
    "rating",
    "stars",
    "score",
    "nota",
    "customer_rating",
    "review_rating",
    "rating_score",
  ]);

  const comment = getText(record, [
    "comment",
    "review",
    "feedback",
    "message",
    "comentario",
    "customer_review",
    "customer_comment",
    "review_comment",
  ]);

  if (!rating && !comment) {
    return null;
  }

  const id = getText(record, ["id", "review_id"]);
  const orderId = getText(record, ["order_id", "pedido_id"]);
  const orderNumber = getText(record, [
    "public_order_number",
    "order_number",
    "pedido_numero",
    "order_public_number",
  ]);
  const customerName = getText(record, [
    "customer_name",
    "customerName",
    "client_name",
    "nome_cliente",
    "name",
  ]);
  const customerPhone = getText(record, [
    "customer_phone",
    "customerPhone",
    "client_phone",
    "telefone_cliente",
    "phone",
  ]);
  const createdAt = getText(record, [
    "reviewed_at",
    "created_at",
    "updated_at",
    "date",
  ]);

  return {
    id:
      id || `${source}-${orderId || orderNumber || createdAt || Math.random()}`,
    customerName: customerName || "Cliente",
    customerPhone,
    rating: Math.min(Math.max(rating, 0), 5),
    comment: comment || "Cliente avaliou sem comentário.",
    orderId,
    orderNumber,
    createdAt,
    source,
  };
}

function getEmptyCampaignRevenueMetrics(): CampaignRevenueMetrics {
  return {
    loyaltyRevenue: 0,
    loyaltyOrders: 0,
    cashbackRevenue: 0,
    cashbackOrders: 0,
    cashbackGenerated: 0,
    cashbackUsed: 0,
    upsellRevenue: 0,
    upsellSales: 0,
    smartCampaignRevenue: 0,
    smartCampaignOrders: 0,
  };
}

function getOrderTotal(order: RawRecord) {
  return getNumber(order, [
    "total",
    "amount",
    "total_amount",
    "grand_total",
    "subtotal",
  ]);
}

function getOrderPhone(order: RawRecord) {
  return getText(order, [
    "customer_phone",
    "customerPhone",
    "client_phone",
    "phone",
  ]).replace(/\D/g, "");
}

function isPaidOrDeliveredOrder(order: RawRecord) {
  const paymentStatus = getText(order, ["payment_status"]).toLowerCase();
  const status = getText(order, ["status"]).toLowerCase();

  return (
    paymentStatus === "paid" ||
    status === "delivered" ||
    status === "completed" ||
    status === "finished" ||
    status === "finalizado" ||
    status === "entregue"
  );
}

function hasTextSignal(record: RawRecord, keys: string[], signals: string[]) {
  const text = getText(record, keys).toLowerCase();

  return signals.some((signal) => text.includes(signal));
}

function getItemTotal(item: RawRecord) {
  const directTotal = getNumber(item, [
    "total",
    "total_price",
    "line_total",
    "subtotal",
    "amount",
  ]);

  if (directTotal > 0) {
    return directTotal;
  }

  const quantity = getNumber(item, ["quantity", "qty", "amount_quantity"]);
  const price = getNumber(item, ["unit_price", "price", "item_price"]);

  return quantity > 0 && price > 0 ? quantity * price : 0;
}

function getItemQuantity(item: RawRecord) {
  const quantity = getNumber(item, ["quantity", "qty", "amount_quantity"]);

  return quantity > 0 ? quantity : 1;
}

async function fetchCampaignRevenueMetrics(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
) {
  const metrics = getEmptyCampaignRevenueMetrics();

  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (ordersError || !Array.isArray(ordersData)) {
    return metrics;
  }

  const paidOrders = (ordersData as RawRecord[]).filter(isPaidOrDeliveredOrder);
  const paidOrderIds = paidOrders
    .map((order) => getText(order, ["id"]))
    .filter(Boolean);

  try {
    const { data: loyaltyData } = await supabase
      .from("customer_loyalties")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .limit(1000);

    const loyaltyPhones = new Set(
      Array.isArray(loyaltyData)
        ? (loyaltyData as RawRecord[])
            .map((loyalty) =>
              getText(loyalty, [
                "customer_phone",
                "customerPhone",
                "phone",
                "client_phone",
              ]).replace(/\D/g, ""),
            )
            .filter(Boolean)
        : [],
    );

    const loyaltyOrders = paidOrders.filter((order) => {
      const phone = getOrderPhone(order);

      return (
        (phone && loyaltyPhones.has(phone)) ||
        hasTextSignal(
          order,
          ["campaign_source", "source", "order_source", "origin"],
          ["loyalty", "fidelidade", "card fidelidade"],
        )
      );
    });

    metrics.loyaltyOrders = loyaltyOrders.length;
    metrics.loyaltyRevenue = loyaltyOrders.reduce(
      (sum, order) => sum + getOrderTotal(order),
      0,
    );
  } catch {
    metrics.loyaltyRevenue = 0;
    metrics.loyaltyOrders = 0;
  }

  const cashbackOrders = paidOrders.filter((order) => {
    const cashbackValue = getNumber(order, [
      "cashback_used",
      "cashback_amount",
      "cashback_discount",
      "cashback_value",
    ]);

    return (
      cashbackValue > 0 ||
      hasTextSignal(
        order,
        ["campaign_source", "source", "order_source", "origin"],
        ["cashback"],
      )
    );
  });

  metrics.cashbackOrders = cashbackOrders.length;
  metrics.cashbackRevenue = cashbackOrders.reduce(
    (sum, order) => sum + getOrderTotal(order),
    0,
  );
  metrics.cashbackUsed = cashbackOrders.reduce(
    (sum, order) =>
      sum +
      getNumber(order, [
        "cashback_used",
        "cashback_amount",
        "cashback_discount",
        "cashback_value",
      ]),
    0,
  );

  try {
    const { data: cashbackTransactionsData } = await supabase
      .from("cashback_transactions")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .limit(1000);

    if (Array.isArray(cashbackTransactionsData)) {
      metrics.cashbackGenerated = (cashbackTransactionsData as RawRecord[])
        .filter((transaction) => {
          const type = getText(transaction, [
            "type",
            "transaction_type",
            "kind",
            "operation",
          ]).toLowerCase();

          return !type || type.includes("earn") || type.includes("credit");
        })
        .reduce(
          (sum, transaction) =>
            sum + getNumber(transaction, ["amount", "value", "total"]),
          0,
        );
    }
  } catch {
    metrics.cashbackGenerated = 0;
  }

  try {
    const { data: redemptionsData } = await supabase
      .from("campaign_redemptions")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .limit(1000);

    if (Array.isArray(redemptionsData)) {
      const redemptionOrderIds = new Set(
        (redemptionsData as RawRecord[])
          .map((redemption) => getText(redemption, ["order_id", "pedido_id"]))
          .filter(Boolean),
      );

      const smartOrders = paidOrders.filter((order) => {
        const orderId = getText(order, ["id"]);

        return (
          (orderId && redemptionOrderIds.has(orderId)) ||
          hasTextSignal(
            order,
            ["campaign_source", "source", "order_source", "origin"],
            ["campaign", "campanha", "intelligent", "inteligente"],
          )
        );
      });

      metrics.smartCampaignOrders = smartOrders.length;
      metrics.smartCampaignRevenue = smartOrders.reduce(
        (sum, order) => sum + getOrderTotal(order),
        0,
      );
    }
  } catch {
    metrics.smartCampaignRevenue = 0;
    metrics.smartCampaignOrders = 0;
  }

  if (paidOrderIds.length > 0) {
    try {
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", paidOrderIds.slice(0, 500))
        .limit(2000);

      if (Array.isArray(itemsData)) {
        const upsellItems = (itemsData as RawRecord[]).filter((item) => {
          const hasUpsellFlag = Boolean(
            item.is_upsell || item.upsell_rule_id || item.upsell_id,
          );

          return (
            hasUpsellFlag ||
            hasTextSignal(
              item,
              ["source", "origin", "item_type", "type", "category"],
              ["upsell", "adicional", "complemento", "combo"],
            )
          );
        });

        metrics.upsellRevenue = upsellItems.reduce(
          (sum, item) => sum + getItemTotal(item),
          0,
        );
        metrics.upsellSales = upsellItems.reduce(
          (sum, item) => sum + getItemQuantity(item),
          0,
        );
      }
    } catch {
      metrics.upsellRevenue = 0;
      metrics.upsellSales = 0;
    }
  }

  const upsellOrders = paidOrders.filter((order) => {
    const upsellValue = getNumber(order, [
      "upsell_total",
      "upsell_extra_total",
      "extra_revenue",
    ]);

    return (
      upsellValue > 0 ||
      hasTextSignal(
        order,
        ["campaign_source", "source", "order_source", "origin"],
        ["upsell"],
      )
    );
  });

  if (metrics.upsellRevenue <= 0 && upsellOrders.length > 0) {
    metrics.upsellRevenue = upsellOrders.reduce(
      (sum, order) =>
        sum +
        getNumber(order, ["upsell_total", "upsell_extra_total", "extra_revenue"]),
      0,
    );
    metrics.upsellSales = upsellOrders.length;
  }

  return metrics;
}

async function fetchRestaurantReviews(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
) {
  const reviewTables = ["order_reviews", "customer_reviews", "reviews"];

  for (const table of reviewTables) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data
        .map((record) => normalizeReview(record as RawRecord, "Avaliação"))
        .filter((review): review is CampaignReview => Boolean(review));
    }
  }

  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(150);

  if (ordersError || !Array.isArray(ordersData)) {
    return [];
  }

  return ordersData
    .map((record) => normalizeReview(record as RawRecord, "Pedido"))
    .filter((review): review is CampaignReview => Boolean(review));
}

export default function CampanhasPage() {
  const supabase = useMemo(() => createClient(), []);

  const [overview, setOverview] = useState<CampaignOverview | null>(null);
  const [campaignRevenue, setCampaignRevenue] = useState<CampaignRevenueMetrics>(
    getEmptyCampaignRevenueMetrics(),
  );
  const [reviews, setReviews] = useState<CampaignReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCampaignRevenueLoading, setIsCampaignRevenueLoading] = useState(false);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewsErrorMessage, setReviewsErrorMessage] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [reviewSearch, setReviewSearch] = useState("");
  const [showReviewsDetails, setShowReviewsDetails] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error("Sessão inválida. Faça login novamente.");
        }

        const response = await fetch("/api/campanhas/overview", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data?.message || "Erro ao carregar visão geral das campanhas.",
          );
        }

        if (isMounted) {
          setOverview(data);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Erro inesperado ao carregar campanhas.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    const restaurantId = overview?.restaurant?.id;

    if (!restaurantId) {
      return;
    }

    const currentRestaurantId: string = restaurantId;
    let isMounted = true;

    async function loadReviews() {
      try {
        setIsReviewsLoading(true);
        setReviewsErrorMessage("");

        const data = await fetchRestaurantReviews(supabase, currentRestaurantId);

        if (isMounted) {
          setReviews(data);
        }
      } catch (error) {
        if (isMounted) {
          setReviewsErrorMessage(
            error instanceof Error
              ? error.message
              : "Erro ao carregar avaliações dos clientes.",
          );
        }
      } finally {
        if (isMounted) {
          setIsReviewsLoading(false);
        }
      }
    }

    void loadReviews();

    return () => {
      isMounted = false;
    };
  }, [overview?.restaurant?.id, supabase]);

  useEffect(() => {
    const restaurantId = overview?.restaurant?.id;

    if (!restaurantId) {
      return;
    }

    const currentRestaurantId: string = restaurantId;
    let isMounted = true;

    async function loadCampaignRevenue() {
      try {
        setIsCampaignRevenueLoading(true);

        const data = await fetchCampaignRevenueMetrics(
          supabase,
          currentRestaurantId,
        );

        if (isMounted) {
          setCampaignRevenue(data);
        }
      } catch {
        if (isMounted) {
          setCampaignRevenue(getEmptyCampaignRevenueMetrics());
        }
      } finally {
        if (isMounted) {
          setIsCampaignRevenueLoading(false);
        }
      }
    }

    void loadCampaignRevenue();

    return () => {
      isMounted = false;
    };
  }, [overview?.restaurant?.id, supabase]);


  const averageRating = useMemo(() => {
    const reviewsWithRating = reviews.filter((review) => review.rating > 0);

    if (reviewsWithRating.length === 0) {
      return 0;
    }

    const total = reviewsWithRating.reduce(
      (sum, review) => sum + review.rating,
      0,
    );

    return total / reviewsWithRating.length;
  }, [reviews]);

  const positiveReviews = useMemo(() => {
    return reviews.filter((review) => review.rating >= 4).length;
  }, [reviews]);

  const attentionReviews = useMemo(() => {
    return reviews.filter((review) => review.rating > 0 && review.rating <= 3)
      .length;
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const search = reviewSearch.trim().toLowerCase();

    return reviews.filter((review) => {
      if (reviewFilter === "positive" && review.rating < 4) {
        return false;
      }

      if (
        reviewFilter === "attention" &&
        (review.rating === 0 || review.rating > 3)
      ) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        review.customerName,
        review.customerPhone,
        review.comment,
        review.orderNumber,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [reviewFilter, reviewSearch, reviews]);

  const latestReviews = useMemo(() => {
    return reviews.slice(0, 3);
  }, [reviews]);

  if (isLoading) {
    return (
      <AdminLayout title="Campanhas">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm font-semibold text-slate-600">
              Carregando visão geral das campanhas...
            </span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (errorMessage || !overview) {
    return (
      <AdminLayout title="Campanhas">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-4xl rounded-[28px] border border-red-100 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  Não foi possível carregar as campanhas
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {errorMessage ||
                    "Tente atualizar a página ou fazer login novamente."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const openOpportunities =
    overview.insights.customersCloseToComplete +
    overview.insights.inactiveCustomers +
    attentionReviews;

  const upsellRevenue = campaignRevenue.upsellRevenue;
  const upsellSales = campaignRevenue.upsellSales;
  const cashbackGenerated = campaignRevenue.cashbackGenerated;
  const cashbackUsed = campaignRevenue.cashbackUsed;

  const campaignModules = [
    {
      title: "Card Fidelidade",
      subtitle: overview.cardFidelidade.hasCampaign
        ? `Prêmio: ${overview.cardFidelidade.rewardTitle}`
        : "Meta de pedidos com recompensa",
      status: overview.cardFidelidade.isActive ? "Ativo" : "Inativo",
      statusTone: overview.cardFidelidade.isActive ? "active" : "neutral",
      href: "/campanhas/fidelidade",
      action: overview.cardFidelidade.hasCampaign ? "Gerenciar" : "Criar",
      icon: Star,
      tone: "orange",
      mainLabel: "Clientes",
      mainValue: formatNumber(overview.cardFidelidade.participants),
      sideLabel: "Resgates",
      sideValue: `${formatNumber(overview.cardFidelidade.redeemedRewards)} usados`,
      progressLabel: `${formatNumber(overview.cardFidelidade.pendingRewards)} pendentes • ${formatPercent(overview.cardFidelidade.progress)} da meta`,
      progressValue: overview.cardFidelidade.progress,
    },
    {
      title: "Cashback",
      subtitle: "Crédito gerado para o cliente voltar",
      status: cashbackGenerated > 0 ? "Ativo" : "Configurar",
      statusTone: cashbackGenerated > 0 ? "active" : "warning",
      href: "/campanhas/cashback",
      action: "Abrir",
      icon: Coins,
      tone: "green",
      mainLabel: "Crédito gerado",
      mainValue: formatCurrency(cashbackGenerated),
      sideLabel: "Crédito usado",
      sideValue: formatCurrency(cashbackUsed),
      progressLabel: "Quando ativar, mostra quanto virou recompra",
      progressValue:
        cashbackGenerated > 0 ? (cashbackUsed / cashbackGenerated) * 100 : 0,
    },
    {
      title: "Upsell",
      subtitle: "Adicionais, bebidas e combos vendidos no carrinho",
      status: "Medir",
      statusTone: "info",
      href: "/campanhas/upsell",
      action: "Abrir",
      icon: BadgePercent,
      tone: "blue",
      mainLabel: "Faturamento extra",
      mainValue: formatCurrency(upsellRevenue),
      sideLabel: "Vendas",
      sideValue: `${formatNumber(upsellSales)} itens`,
      progressLabel: "Exemplo: adicional de R$ 3 vendido 10x = R$ 30 extra",
      progressValue: upsellSales > 0 ? 100 : 0,
    },
  ] satisfies CampaignModuleItem[];

  const campaignRevenueItems = [
    {
      title: "Upsell",
      description: "Adicionais, bebidas e combos",
      revenue: campaignRevenue.upsellRevenue,
      detail: `${formatNumber(campaignRevenue.upsellSales)} itens vendidos`,
      href: "/campanhas/upsell",
      tone: "blue",
    },
    {
      title: "Card Fidelidade",
      description: "Pedidos de clientes participantes",
      revenue: campaignRevenue.loyaltyRevenue,
      detail: `${formatNumber(campaignRevenue.loyaltyOrders)} pedidos rastreados`,
      href: "/campanhas/fidelidade",
      tone: "orange",
    },
    {
      title: "Cashback",
      description: "Pedidos com crédito de recompra",
      revenue: campaignRevenue.cashbackRevenue,
      detail: `${formatNumber(campaignRevenue.cashbackOrders)} pedidos com cashback`,
      href: "/campanhas/cashback",
      tone: "green",
    },
    {
      title: "Campanhas inteligentes",
      description: "Cupons, reativação e ações sugeridas",
      revenue: campaignRevenue.smartCampaignRevenue,
      detail: `${formatNumber(campaignRevenue.smartCampaignOrders)} pedidos rastreados`,
      href: "/campanhas/inteligentes",
      tone: "purple",
    },
  ] satisfies CampaignRevenueItem[];

  return (
    <AdminLayout title="Campanhas">
      <div className="space-y-3">
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700 ring-1 ring-blue-100">
                <TrendingUp className="h-3.5 w-3.5" />
                Central de crescimento
              </div>

              <h1 className="text-xl font-black tracking-tight text-slate-950 md:text-2xl">
                Campanhas e resultados
              </h1>

              <p className="mt-0.5 max-w-3xl text-sm font-medium text-slate-500">
                Controle fidelidade, cashback, upsell e ações inteligentes sem
                depender de cards grandes ou informação espalhada.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowReviewsDetails(true)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <MessageSquare className="h-4 w-4 text-blue-600" />
                Comentários
              </button>

              <Link
                href="/campanhas/fidelidade"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-black text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700"
              >
                <Megaphone className="h-4 w-4" />
                Nova campanha
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <CompactMetric
            title="Faturamento analisado"
            value={formatCurrency(overview.totals.revenue)}
            description={`${formatNumber(
              overview.totals.paidOrDeliveredOrders,
            )} pedidos pagos/entregues`}
            icon={Coins}
            tone="green"
          />

          <CompactMetric
            title="Clientes em fidelidade"
            value={formatNumber(overview.summary.fidelizedCustomers)}
            description={`${formatNumber(
              overview.cardFidelidade.customersCloseToComplete,
            )} perto do prêmio`}
            icon={UsersRound}
            tone="orange"
          />

          <CompactMetric
            title="Benefícios resgatados"
            value={formatNumber(overview.summary.monthlyRedemptions)}
            description={`${formatNumber(
              overview.cardFidelidade.pendingRewards,
            )} aguardando resgate`}
            icon={Gift}
            tone="purple"
          />

          <CompactMetric
            title="Ações sugeridas"
            value={formatNumber(openOpportunities)}
            description="oportunidades para agir hoje"
            icon={Target}
            tone="blue"
          />
        </section>

        <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-3">
            <CampaignModulesTable modules={campaignModules} />

            <CampaignRevenueBarChart
              items={campaignRevenueItems}
              totalRevenue={overview.totals.revenue}
              isLoading={isCampaignRevenueLoading}
            />
          </div>

          <div className="space-y-3">
            <ActionQueue
              closeToComplete={overview.insights.customersCloseToComplete}
              inactiveCustomers={overview.insights.inactiveCustomers}
              attentionReviews={attentionReviews}
              onOpenReviews={() => setShowReviewsDetails(true)}
            />

            <ReputationSummary
              averageRating={averageRating}
              positiveReviews={positiveReviews}
              attentionReviews={attentionReviews}
              reviews={reviews}
              latestReviews={latestReviews}
              isLoading={isReviewsLoading}
              errorMessage={reviewsErrorMessage}
              onOpenDetails={() => setShowReviewsDetails(true)}
            />
          </div>
        </section>

        
      </div>

      {showReviewsDetails ? (
        <ReviewsModal
          reviews={filteredReviews}
          reviewFilter={reviewFilter}
          reviewSearch={reviewSearch}
          setReviewFilter={setReviewFilter}
          setReviewSearch={setReviewSearch}
          onClose={() => setShowReviewsDetails(false)}
        />
      ) : null}
    </AdminLayout>
  );
}

function getToneClasses(tone: Tone) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    orange: "bg-orange-50 text-orange-600 ring-orange-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    purple: "bg-violet-50 text-violet-600 ring-violet-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return toneClasses[tone];
}

function getStatusToneClasses(tone: StatusTone) {
  const toneClasses = {
    active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    warning: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    neutral: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    info: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  };

  return toneClasses[tone];
}

function CompactMetric({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${getToneClasses(
            tone,
          )}`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-slate-400">
            {title}
          </p>
          <p className="mt-0.5 truncate text-lg font-black leading-tight text-slate-950">
            {value}
          </p>
          <p className="truncate text-xs font-semibold text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

type CampaignModuleItem = {
  title: string;
  subtitle: string;
  status: string;
  statusTone: StatusTone;
  href: string;
  action: string;
  icon: LucideIcon;
  tone: Tone;
  mainLabel: string;
  mainValue: string;
  sideLabel: string;
  sideValue: string;
  progressLabel: string;
  progressValue: number;
};

function CampaignModulesTable({ modules }: { modules: CampaignModuleItem[] }) {
  return (
    <div className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-950">
            Métricas por campanha
          </h2>
          <p className="text-xs font-bold text-slate-400">
            Cada bloco mostra uso, dinheiro gerado ou oportunidade real.
          </p>
        </div>

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">
          <Zap className="h-3.5 w-3.5" />
          Ajusta conforme a quantidade
        </span>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {modules.map((module) => (
          <CampaignMetricCard key={module.title} module={module} />
        ))}
      </div>
    </div>
  );
}

function CampaignMetricCard({ module }: { module: CampaignModuleItem }) {
  const Icon = module.icon;
  const progressWidth = Math.min(Math.max(module.progressValue || 0, 0), 100);

  return (
    <Link
      href={module.href}
      className="group rounded-2xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${getToneClasses(
              module.tone,
            )}`}
          >
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">
              {module.title}
            </p>
            <p className="line-clamp-1 text-xs font-semibold text-slate-500">
              {module.subtitle}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${getStatusToneClasses(
            module.statusTone,
          )}`}
        >
          {module.status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white bg-white px-2.5 py-2 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            {module.mainLabel}
          </p>
          <p className="mt-0.5 truncate text-base font-black text-slate-950">
            {module.mainValue}
          </p>
        </div>

        <div className="rounded-xl border border-white bg-white px-2.5 py-2 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            {module.sideLabel}
          </p>
          <p className="mt-0.5 truncate text-base font-black text-slate-950">
            {module.sideValue}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="line-clamp-1 text-[11px] font-bold text-slate-500">
            {module.progressLabel}
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700">
            {module.action}
            <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
          </span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function CampaignRevenueBarChart({
  items,
  totalRevenue,
  isLoading,
}: {
  items: CampaignRevenueItem[];
  totalRevenue: number;
  isLoading: boolean;
}) {
  const maxRevenue = Math.max(...items.map((item) => item.revenue), 0);
  const trackedRevenue = items.reduce((sum, item) => sum + item.revenue, 0);
  const hasRevenue = maxRevenue > 0;

  return (
    <div className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-950">
            Faturamento por campanha
          </h2>
          <p className="text-xs font-bold text-slate-400">
            Mostra qual estratégia está ajudando a colocar dinheiro no caixa.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-1.5 text-right ring-1 ring-slate-200">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Rastreado
          </p>
          <p className="text-sm font-black text-slate-950">
            {formatCurrency(trackedRevenue)}
          </p>
        </div>
      </div>

      <div className="space-y-2.5 p-4">
        {isLoading ? (
          <div className="flex h-[132px] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Calculando faturamento das campanhas...
          </div>
        ) : (
          items.map((item) => (
            <CampaignRevenueBar
              key={item.title}
              item={item}
              maxRevenue={maxRevenue}
            />
          ))
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-slate-500">
            {hasRevenue
              ? `${formatCurrency(trackedRevenue)} de ${formatCurrency(
                  totalRevenue,
                )} já está ligado a campanhas.`
              : "Ainda não existe venda rastreada por campanha."}
          </p>

          <p className="text-xs font-semibold text-slate-400">
            Para ficar 100%, cada pedido precisa salvar a origem da campanha.
          </p>
        </div>
      </div>
    </div>
  );
}

function CampaignRevenueBar({
  item,
  maxRevenue,
}: {
  item: CampaignRevenueItem;
  maxRevenue: number;
}) {
  const width = maxRevenue > 0 ? Math.max((item.revenue / maxRevenue) * 100, 4) : 0;

  return (
    <Link
      href={item.href}
      className="group block rounded-xl border border-slate-100 bg-white px-3 py-2.5 transition hover:border-blue-200 hover:bg-blue-50/30"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">
            {item.title}
          </p>
          <p className="truncate text-xs font-semibold text-slate-500">
            {item.description}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-black text-slate-950">
            {formatCurrency(item.revenue)}
          </p>
          <p className="text-[11px] font-bold text-slate-400">{item.detail}</p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${getRevenueBarClasses(
            item.tone,
          )}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </Link>
  );
}

function getRevenueBarClasses(tone: Tone) {
  const toneClasses = {
    blue: "bg-blue-600",
    orange: "bg-orange-500",
    green: "bg-emerald-500",
    purple: "bg-violet-500",
    slate: "bg-slate-500",
  };

  return toneClasses[tone];
}

function ActionQueue({
  closeToComplete,
  inactiveCustomers,
  attentionReviews,
  onOpenReviews,
}: {
  closeToComplete: number;
  inactiveCustomers: number;
  attentionReviews: number;
  onOpenReviews: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-black text-slate-950">O que fazer agora</h2>
        <p className="text-xs font-bold text-slate-400">
          Ações curtas para vender mais ou evitar perda de cliente.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        <ActionQueueItem
          icon={Trophy}
          title={`${formatNumber(closeToComplete)} clientes perto da recompensa`}
          description="Boa hora para incentivar mais um pedido."
          label="Fidelidade"
          tone="orange"
          href="/campanhas/fidelidade"
        />

        <ActionQueueItem
          icon={Clock3}
          title={`${formatNumber(inactiveCustomers)} clientes inativos há 15 dias`}
          description="Recupere clientes que pararam de comprar."
          label="Retenção"
          tone="purple"
          href="/clientes"
        />

        <ActionQueueItem
          icon={MessageSquare}
          title={`${formatNumber(attentionReviews)} avaliações precisam atenção`}
          description="Responder rápido protege a reputação."
          label="Reputação"
          tone="blue"
          onClick={onOpenReviews}
        />

        <ActionQueueItem
          icon={BadgePercent}
          title="Criar oferta de upsell"
          description="Sugira bebida, adicional ou sobremesa no carrinho."
          label="Ticket médio"
          tone="green"
          href="/campanhas/upsell"
        />
      </div>
    </div>
  );
}

function ActionQueueItem({
  icon: Icon,
  title,
  description,
  label,
  tone,
  href,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  label: string;
  tone: Tone;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${getToneClasses(
          tone,
        )}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-black text-slate-950">{title}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
            {label}
          </span>
        </div>
        <p className="truncate text-xs font-semibold text-slate-500">
          {description}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
    </>
  );

  const className =
    "group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50/80";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href || "/campanhas"} className={className}>
      {content}
    </Link>
  );
}

function ReputationSummary({
  averageRating,
  positiveReviews,
  attentionReviews,
  reviews,
  latestReviews,
  isLoading,
  errorMessage,
  onOpenDetails,
}: {
  averageRating: number;
  positiveReviews: number;
  attentionReviews: number;
  reviews: CampaignReview[];
  latestReviews: CampaignReview[];
  isLoading: boolean;
  errorMessage: string;
  onOpenDetails: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-black text-slate-950">Reputação</h2>
          <p className="text-xs font-bold text-slate-400">
            Resumo das avaliações recentes.
          </p>
        </div>

        <button
          id="comentarios"
          type="button"
          onClick={onOpenDetails}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-black text-blue-700 transition hover:bg-blue-50"
        >
          Ver tudo
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        <ReviewMiniMetric label="Média" value={formatRating(averageRating)} />
        <ReviewMiniMetric
          label="Positivas"
          value={formatNumber(positiveReviews)}
        />
        <ReviewMiniMetric
          label="Atenção"
          value={formatNumber(attentionReviews)}
        />
      </div>

      <div className="p-2">
        {isLoading ? (
          <div className="flex h-[116px] items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Carregando avaliações...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
            {errorMessage}
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-1.5">
            {latestReviews.map((review) => (
              <ReviewCompactRow key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div className="flex h-[116px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
            <p className="text-sm font-bold text-slate-500">
              Nenhuma avaliação encontrada ainda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-black leading-none text-slate-950">
        {value}
      </p>
    </div>
  );
}

function ReviewCompactRow({ review }: { review: CampaignReview }) {
  const isAttention = review.rating > 0 && review.rating <= 3;

  return (
    <button
      type="button"
      className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50/30"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[11px] font-black text-white">
          {getInitials(review.customerName)}
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-black text-slate-950">
              {review.customerName}
            </p>
            <span className="text-xs font-bold text-slate-400">
              {formatDateTime(review.createdAt)}
            </span>
          </div>
          <p className="truncate text-xs font-semibold text-slate-500">
            “{review.comment}”
          </p>
        </div>
      </div>

      <span
        className={`rounded-full px-2.5 py-1 text-xs font-black ${
          isAttention
            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
            : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
        }`}
      >
        {formatRating(review.rating)}
      </span>
    </button>
  );
}



function ReviewFilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-sm font-black transition ${
        active
          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => {
        const isFilled = index < Math.round(rating);

        return (
          <Star
            key={index}
            className={`h-4 w-4 ${
              isFilled
                ? "fill-orange-400 text-orange-400"
                : "fill-slate-100 text-slate-200"
            }`}
          />
        );
      })}
    </div>
  );
}

function ReviewsModal({
  reviews,
  reviewFilter,
  reviewSearch,
  setReviewFilter,
  setReviewSearch,
  onClose,
}: {
  reviews: CampaignReview[];
  reviewFilter: ReviewFilter;
  reviewSearch: string;
  setReviewFilter: (filter: ReviewFilter) => void;
  setReviewSearch: (search: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <MessageSquare className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-950">
                Comentários e avaliações
              </h2>
              <p className="text-sm font-medium text-slate-500">
                Veja quem avaliou, nota, comentário e pedido vinculado.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="Fechar avaliações"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <ReviewFilterButton
                active={reviewFilter === "all"}
                onClick={() => setReviewFilter("all")}
              >
                Todas
              </ReviewFilterButton>
              <ReviewFilterButton
                active={reviewFilter === "positive"}
                onClick={() => setReviewFilter("positive")}
              >
                Positivas
              </ReviewFilterButton>
              <ReviewFilterButton
                active={reviewFilter === "attention"}
                onClick={() => setReviewFilter("attention")}
              >
                Precisam atenção
              </ReviewFilterButton>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={reviewSearch}
                onChange={(event) => setReviewSearch(event.target.value)}
                placeholder="Buscar cliente, pedido ou comentário"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-4">
          {reviews.length > 0 ? (
            <div className="space-y-2">
              {reviews.map((review) => (
                <ReviewDetailRow key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
              <p className="text-sm font-bold text-slate-500">
                Nenhuma avaliação encontrada com esse filtro.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewDetailRow({ review }: { review: CampaignReview }) {
  const isPositive = review.rating >= 4;
  const isAttention = review.rating > 0 && review.rating <= 3;

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm md:grid-cols-[1.1fr_0.75fr_1.7fr_0.8fr] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
          {getInitials(review.customerName)}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">
            {review.customerName}
          </p>
          <p className="text-xs font-bold text-slate-400">
            {review.customerPhone
              ? maskPhone(review.customerPhone)
              : "Telefone não informado"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <RatingStars rating={review.rating} />
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-black ${
            isPositive
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : isAttention
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          {isPositive ? "Positiva" : isAttention ? "Atenção" : "Sem nota"}
        </span>
      </div>

      <p className="text-sm font-semibold leading-5 text-slate-600">
        “{review.comment}”
      </p>

      <div className="text-xs font-bold text-slate-400 md:text-right">
        <p>{formatDateTime(review.createdAt)}</p>
        <p className="mt-1 text-blue-600">
          {review.orderNumber
            ? `Pedido #${review.orderNumber}`
            : review.orderId
              ? `Pedido ${review.orderId.slice(0, 8)}`
              : review.source}
        </p>
      </div>
    </div>
  );
}
