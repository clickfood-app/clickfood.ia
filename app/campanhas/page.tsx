"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Gift,
  Loader2,
  Megaphone,
  MessageSquare,
  Pencil,
  Search,
  Star,
  TrendingUp,
  UserRoundCheck,
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

type ReviewFilter = "all" | "positive" | "attention";

type RawRecord = Record<string, unknown>;

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
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
  const [reviews, setReviews] = useState<CampaignReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const recentCampaigns = useMemo(() => {
    return overview?.recentCampaigns ?? [];
  }, [overview]);

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

  return (
    <AdminLayout title="Campanhas">
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700 ring-1 ring-blue-100">
                <TrendingUp className="h-3.5 w-3.5" />
                Central de campanhas
              </div>

              <h1 className="text-xl font-black tracking-tight text-slate-950 md:text-2xl">
                Visão geral
              </h1>

              <p className="mt-0.5 text-sm font-medium text-slate-500">
                Campanhas, fidelidade, reputação e oportunidades do restaurante.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowReviewsDetails(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <MessageSquare className="h-4 w-4 text-blue-600" />
                Ver comentários
              </button>

              <Link
                href="/campanhas/fidelidade"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 text-sm font-black text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700"
              >
                <Megaphone className="h-4 w-4" />
                Criar campanha
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Campanhas ativas"
            value={formatNumber(overview.summary.activeCampaigns)}
            description="em funcionamento"
            icon={Megaphone}
            tone="blue"
          />

          <MetricCard
            title="Clientes fidelizados"
            value={formatNumber(overview.summary.fidelizedCustomers)}
            description="participando"
            icon={UsersRound}
            tone="orange"
          />

          <MetricCard
            title="Resgates no mês"
            value={formatNumber(overview.summary.monthlyRedemptions)}
            description="prêmios entregues"
            icon={Gift}
            tone="purple"
          />

          <MetricCard
            title="Avaliação média"
            value={formatRating(averageRating)}
            description={`${formatNumber(reviews.length)} avaliações`}
            icon={Star}
            tone="green"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <CampaignFocusCard overview={overview} />

          <div className="grid gap-4">
            <ReputationCard
              averageRating={averageRating}
              positiveReviews={positiveReviews}
              attentionReviews={attentionReviews}
              reviews={reviews}
              latestReviews={latestReviews}
              isLoading={isReviewsLoading}
              errorMessage={reviewsErrorMessage}
              onOpenDetails={() => setShowReviewsDetails(true)}
            />

            <OpportunitiesCard
              closeToComplete={overview.insights.customersCloseToComplete}
              inactiveCustomers={overview.insights.inactiveCustomers}
              reviewsCount={reviews.length}
            />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_0.75fr]">
          <RecentPerformance campaigns={recentCampaigns} />
          <QuickActions />
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

function MetricCard({
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
  tone: "blue" | "orange" | "green" | "purple";
}) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    orange: "bg-orange-50 text-orange-600 ring-orange-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    purple: "bg-violet-50 text-violet-600 ring-violet-100",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${toneClasses[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-wide text-slate-400">
            {title}
          </p>
          <div className="mt-1 flex items-end gap-2">
            <p className="text-2xl font-black leading-none tracking-tight text-slate-950">
              {value}
            </p>
            <p className="mb-0.5 truncate text-xs font-bold text-slate-400">
              {description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignFocusCard({ overview }: { overview: CampaignOverview }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
            <Star className="h-5 w-5 fill-orange-500" />
          </div>

          <div>
            <h2 className="text-base font-black text-slate-950">
              Card Fidelidade
            </h2>
            <p className="text-xs font-bold text-slate-400">
              Campanha principal de recompra
            </p>
          </div>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-black ${
            overview.cardFidelidade.isActive
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
          }`}
        >
          {overview.cardFidelidade.isActive ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div className="p-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-orange-300">
                {overview.cardFidelidade.hasCampaign
                  ? "Campanha atual"
                  : "Nenhuma campanha ativa"}
              </p>

              <h3 className="mt-1 truncate text-xl font-black">
                {overview.cardFidelidade.hasCampaign
                  ? overview.cardFidelidade.title
                  : "Crie seu primeiro card fidelidade"}
              </h3>

              <p className="mt-1 truncate text-sm font-semibold text-slate-300">
                {overview.cardFidelidade.hasCampaign
                  ? `Prêmio: ${overview.cardFidelidade.rewardTitle}`
                  : "Configure uma meta simples para estimular recompra."}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
              <Gift className="h-4 w-4 text-orange-300" />
              <span className="text-sm font-black">
                Meta: {formatNumber(overview.cardFidelidade.requiredOrders)}{" "}
                pedidos
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <MiniStat
            icon={UsersRound}
            label="Participantes"
            value={formatNumber(overview.cardFidelidade.participants)}
          />

          <MiniStat
            icon={Gift}
            label="Pendentes"
            value={formatNumber(overview.cardFidelidade.pendingRewards)}
          />

          <MiniStat
            icon={CheckCircle2}
            label="Resgatados"
            value={formatNumber(overview.cardFidelidade.redeemedRewards)}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-500">
            <span>Progresso geral</span>
            <span>{formatPercent(overview.cardFidelidade.progress)}</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-blue-600 transition-all"
              style={{
                width: `${Math.min(
                  Math.max(overview.cardFidelidade.progress, 0),
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link
            href="/campanhas/fidelidade"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-black text-blue-700 transition hover:bg-blue-100"
          >
            Ver campanha
            <ExternalLink className="h-4 w-4" />
          </Link>

          <Link
            href="/campanhas/fidelidade"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold text-slate-400">
            {label}
          </p>
          <p className="text-sm font-black text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ReputationCard({
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <MessageSquare className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-base font-black text-slate-950">Reputação</h2>
            <p className="text-xs font-bold text-slate-400">
              Avaliações recentes dos pedidos
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenDetails}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-blue-700 transition hover:bg-blue-50"
        >
          Ver comentários
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
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

      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
        {isLoading ? (
          <div className="flex h-[132px] items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Carregando avaliações...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
            {errorMessage}
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-2">
            {latestReviews.map((review) => (
              <ReviewCompactRow key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div className="flex h-[132px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 text-center">
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
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
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
      className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left transition hover:border-blue-200 hover:bg-blue-50/30"
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

function OpportunitiesCard({
  closeToComplete,
  inactiveCustomers,
  reviewsCount,
}: {
  closeToComplete: number;
  inactiveCustomers: number;
  reviewsCount: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
          <Zap className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-base font-black text-slate-950">Oportunidades</h2>
          <p className="text-xs font-bold text-slate-400">
            Pontos rápidos para agir hoje
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <InsightCard
          icon={UsersRound}
          tone="orange"
          text={`${formatNumber(closeToComplete)} clientes perto da recompensa`}
        />

        <InsightCard
          icon={Clock3}
          tone="purple"
          text={`${formatNumber(inactiveCustomers)} clientes inativos há 15 dias`}
        />

        <InsightCard
          icon={MessageSquare}
          tone="blue"
          text={`${formatNumber(reviewsCount)} avaliações recebidas`}
        />
      </div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  text,
  tone,
}: {
  icon: LucideIcon;
  text: string;
  tone: "orange" | "blue" | "purple";
}) {
  const toneClasses = {
    orange: "border-orange-100 bg-orange-50 text-orange-600",
    blue: "border-blue-100 bg-blue-50 text-blue-600",
    purple: "border-violet-100 bg-violet-50 text-violet-600",
  };

  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:scale-[1.01] ${toneClasses[tone]}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80">
          <Icon className="h-4 w-4" />
        </div>

        <p className="truncate text-sm font-black text-slate-900">{text}</p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

function RecentPerformance({ campaigns }: { campaigns: RecentCampaign[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <BarChart3 className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-base font-black text-slate-950">
              Desempenho recente
            </h2>
            <p className="text-xs font-bold text-slate-400">
              Últimas campanhas criadas
            </p>
          </div>
        </div>
      </div>

      {campaigns.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Campanha</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Impacto</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Período</th>
              </tr>
            </thead>

            <tbody>
              {campaigns.map((campaign) => (
                <tr
                  key={`${campaign.type}-${campaign.id}`}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                        <Star className="h-4 w-4 fill-orange-500" />
                      </div>

                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {campaign.name}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          {campaign.description}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700 ring-1 ring-orange-200">
                      {campaign.type}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-sm font-black text-slate-900">
                      {campaign.impact}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      {campaign.secondaryImpact}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-black ${getStatusClasses(
                        campaign.status,
                      )}`}
                    >
                      {campaign.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-sm font-bold text-slate-500">
                    {campaign.period}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex min-h-[180px] items-center justify-center px-6 py-8">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Megaphone className="h-5 w-5" />
            </div>

            <h3 className="mt-3 text-base font-black text-slate-900">
              Nenhuma campanha encontrada
            </h3>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Quando uma campanha for criada, o desempenho aparecerá aqui.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickActions() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
          <Zap className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-base font-black text-slate-950">Ações rápidas</h2>
          <p className="text-xs font-bold text-slate-400">
            Caminhos principais
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <QuickAction
          href="/campanhas/fidelidade"
          icon={Star}
          title="Card fidelidade"
          description="Metas e prêmios"
          tone="orange"
        />

        <QuickAction
          href="/clientes"
          icon={UserRoundCheck}
          title="Clientes elegíveis"
          description="Quem pode participar"
          tone="green"
        />

        <QuickAction
          href="/campanhas"
          icon={BarChart3}
          title="Resultados"
          description="Métricas da área"
          tone="purple"
        />
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: "orange" | "blue" | "green" | "purple";
}) {
  const toneClasses = {
    orange: "border-orange-100 bg-orange-50 text-orange-600",
    blue: "border-blue-100 bg-blue-50 text-blue-600",
    green: "border-emerald-100 bg-emerald-50 text-emerald-600",
    purple: "border-violet-100 bg-violet-50 text-violet-600",
  };

  return (
    <Link
      href={href}
      className={`group rounded-xl border px-3 py-2.5 transition hover:-translate-y-0.5 hover:shadow-sm ${toneClasses[tone]}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{title}</p>
          <p className="truncate text-xs font-bold text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[11px] font-black">
        Acessar
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
      </div>
    </Link>
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
