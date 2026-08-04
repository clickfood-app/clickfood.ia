"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BellRing,
  Bot,
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  Eye,
  History,
  Loader2,
  MapPin,
  Package,
  Printer,
  RefreshCcw,
  Search,
  Settings2,
  Truck,
  User,
  Volume2,
  XCircle,
} from "lucide-react";

import AdminLayout from "@/components/admin-layout";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import {
  printThermalOrder,
  printThermalOrdersBatch,
  type ThermalPrintMode,
  type ThermalPrintOrder,
} from "@/lib/thermal-print";

type OrderRow = {
  id: string;
  public_order_number: string | number | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string | null;
  total: number | string | null;
  subtotal?: number | string | null;
  discount?: number | string | null;
  delivery_fee?: number | string | null;
  payment_method: string | null;
  payment_status: string | null;
  needs_change?: boolean | null;
  change_for?: number | string | null;
  notes: string | null;
  source?: string | null;
  order_source?: string | null;
  created_at: string;
  delivery_person_id: string | null;
  accepted_at: string | null;
  preparation_started_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  accept_by: string | null;
  pix_proof_url: string | null;
  pix_proof_path: string | null;
  pix_proof_uploaded_at: string | null;
  pix_confirmed_at: string | null;
  pix_confirmed_by: string | null;
};

type OrderItemModifier = {
  groupId: string | null;
  optionId: string | null;
  groupName: string;
  optionName: string;
  optionPrice: number;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  total: number;
  notes: string | null;
  modifiers: OrderItemModifier[];
  stock_deducted_at: string | null;
};

type DeliveryPerson = {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
};

type OrderItemStockDeductionRow = {
  id: string;
  product_id: string | null;
  quantity: number | string | null;
};

type ProductRecipeStockRow = {
  product_id: string | null;
  stock_item_id: string | null;
  quantity: number | string | null;
};

type StockQuantityRow = {
  id: string;
  current_quantity: number | string | null;
};

type RestaurantPrintData = {
  name: string;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
};

type NewOrderAlert = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  total: number | string | null;
  createdAt: string;
};

type BoardStatus = "analysis" | "preparation" | "ready";
type ViewMode = "operation" | "history";
type HistoryStatusFilter = "all" | "open" | "finished" | "cancelled";
type HistoryPaymentStatusFilter = "all" | "paid" | "pending" | "cancelled";

type HistoryFilters = {
  dateFrom: string;
  dateTo: string;
  status: HistoryStatusFilter;
  paymentStatus: HistoryPaymentStatusFilter;
  paymentMethod: string;
  deliveryPersonId: string;
};

const supabase = createClient();

const OPEN_ORDER_STATUSES = [
  "pending",
  "pendente",
  "in_analysis",
  "em_analise",
  "analise",
  "em análise",
  "accepted",
  "aceito",
  "preparing",
  "em_preparo",
  "em preparo",
  "waiting",
  "aguardando",
  "waiting_payment",
  "awaiting_payment",
  "waiting_customer_payment",
  "pending_payment",
  "ready",
  "pronto",
  "waiting_pix_confirmation",
  "awaiting_pix_review",
  "aguardando_confirmacao_pix",
  "aguardando confirmação pix",
];

const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  dateFrom: "",
  dateTo: "",
  status: "all",
  paymentStatus: "all",
  paymentMethod: "all",
  deliveryPersonId: "all",
};

const columnStyles = {
  analysis: {
    title: "Pendentes",
    description: "Conferir e aceitar",
    icon: Clock3,
    accent: "bg-[#f97316]",
    border: "border-orange-200",
    badge: "border-orange-200 bg-orange-50 text-[#f97316]",
    body: "bg-slate-50",
  },
  preparation: {
    title: "Em preparo",
    description: "Produção na cozinha",
    icon: ChefHat,
    accent: "bg-neutral-900",
    border: "border-neutral-300",
    badge: "border-neutral-300 bg-neutral-50 text-neutral-900",
    body: "bg-slate-50",
  },
  ready: {
    title: "Prontos",
    description: "Retirar ou entregar",
    icon: CheckCircle2,
    accent: "bg-emerald-500",
    border: "border-emerald-200",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    body: "bg-slate-50",
  },
} satisfies Record<BoardStatus, Record<string, string | typeof Clock3>>;

async function ensureSupabaseSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const message = [
      maybeError.message,
      maybeError.details,
      maybeError.hint,
      maybeError.code,
    ]
      .filter(Boolean)
      .join(" · ");

    if (message) return message;
  }

  return fallback;
}

function normalizeStatus(status: string | null | undefined) {
  return (status || "").trim().toLowerCase();
}

function isManualPixMethod(paymentMethod: string | null | undefined) {
  const value = normalizeStatus(paymentMethod);

  return (
    value === "pix_manual" ||
    value === "pix_direto" ||
    value === "pix direto" ||
    value === "pix_manual_receipt"
  );
}

function isPixAwaitingReview(
  order: Pick<OrderRow, "payment_method" | "payment_status" | "status">,
) {
  const paymentStatus = normalizeStatus(order.payment_status);
  const status = normalizeStatus(order.status);

  return (
    isManualPixMethod(order.payment_method) &&
    !["paid", "pago", "approved", "confirmed"].includes(paymentStatus) &&
    ![
      "cancelled",
      "canceled",
      "cancelado",
      "cancelada",
      "failed",
      "falhou",
    ].includes(paymentStatus) &&
    (paymentStatus === "awaiting_pix_confirmation" ||
      paymentStatus === "awaiting_review" ||
      paymentStatus === "waiting_customer_payment" ||
      paymentStatus === "waiting_payment" ||
      paymentStatus === "awaiting_payment" ||
      paymentStatus === "pending_payment" ||
      paymentStatus === "pending" ||
      paymentStatus === "pendente" ||
      paymentStatus === "aguardando_conferencia" ||
      paymentStatus === "aguardando conferência" ||
      status === "waiting_pix_confirmation" ||
      status === "awaiting_pix_review" ||
      status === "waiting_payment" ||
      status === "awaiting_payment" ||
      status === "waiting_customer_payment" ||
      status === "pending_payment" ||
      status === "pending" ||
      status === "pendente" ||
      status === "aguardando_confirmacao_pix" ||
      status === "aguardando confirmação pix")
  );
}

function isAnalysisStatus(status: string | null | undefined) {
  const value = normalizeStatus(status);

  return (
    value === "pending" ||
    value === "pendente" ||
    value === "in_analysis" ||
    value === "em_analise" ||
    value === "analise" ||
    value === "em análise"
  );
}

function isPreparationStatus(status: string | null | undefined) {
  const value = normalizeStatus(status);

  return (
    value === "accepted" ||
    value === "aceito" ||
    value === "preparing" ||
    value === "em_preparo" ||
    value === "em preparo" ||
    value === "waiting" ||
    value === "aguardando"
  );
}

function isReadyStatus(status: string | null | undefined) {
  const value = normalizeStatus(status);

  return (
    value === "ready" ||
    value === "pronto" ||
    value === "done" ||
    value === "prepared"
  );
}

function isPixWaitingStatus(status: string | null | undefined) {
  const value = normalizeStatus(status);

  return (
    value === "waiting_pix_confirmation" ||
    value === "awaiting_pix_review" ||
    value === "waiting_payment" ||
    value === "awaiting_payment" ||
    value === "waiting_customer_payment" ||
    value === "pending_payment" ||
    value === "aguardando_confirmacao_pix" ||
    value === "aguardando confirmação pix"
  );
}

function isPixWaitingOrder(
  order: Pick<OrderRow, "payment_method" | "payment_status" | "status">,
) {
  return isPixAwaitingReview(order);
}

function getBoardStatus(status: string | null | undefined): BoardStatus | null {
  if (isPixWaitingStatus(status)) return "analysis";
  if (isAnalysisStatus(status)) return "analysis";
  if (isPreparationStatus(status)) return "preparation";
  if (isReadyStatus(status)) return "ready";
  return null;
}

function isPdvOrder(order: Partial<OrderRow>) {
  const source = normalizeStatus(order.order_source || order.source);

  if (["pdv", "pos", "balcao", "balcão"].includes(source)) {
    return true;
  }

  return normalizeStatus(order.notes)
    .split(/\r?\n/)
    .some((line) =>
      ["pedido balcão", "pedido balcao", "pedido delivery"].includes(
        line.trim(),
      ),
    );
}

function isOrderVisibleOnBoard(order: Partial<OrderRow>) {
  const pixWaiting = isPixWaitingOrder({
    payment_method: order.payment_method ?? null,
    payment_status: order.payment_status ?? null,
    status: order.status ?? null,
  });

  if (!pixWaiting && getBoardStatus(order.status) === null) return false;

  const paymentMethod = String(order.payment_method || "")
    .trim()
    .toLowerCase();
  const paymentStatus = String(order.payment_status || "")
    .trim()
    .toLowerCase();

  if (paymentMethod === "pix" || paymentMethod === "efi_pix") {
    return paymentStatus === "paid" || isPdvOrder(order);
  }

  if (isManualPixMethod(paymentMethod)) {
    return paymentStatus === "paid" || pixWaiting;
  }

  return true;
}

function getAudioContextConstructor() {
  if (typeof window === "undefined") return null;

  const audioWindow = window as Window &
    typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };

  return window.AudioContext || audioWindow.webkitAudioContext || null;
}

function formatBRL(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatItemCount(count: number) {
  return `${count} ${count === 1 ? "item" : "itens"}`;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrderItemModifiers(
  rawModifiers: unknown,
): OrderItemModifier[] {
  if (!Array.isArray(rawModifiers)) return [];

  return rawModifiers
    .map((rawModifier) => {
      if (!rawModifier || typeof rawModifier !== "object") return null;

      const modifier = rawModifier as Record<string, unknown>;

      const groupName = cleanText(
        modifier.groupName ?? modifier.group_name ?? modifier.group,
      );

      const optionName = cleanText(
        modifier.optionName ??
          modifier.option_name ??
          modifier.name ??
          modifier.option,
      );

      const optionPrice = Number(
        modifier.optionPrice ?? modifier.option_price ?? modifier.price ?? 0,
      );

      if (!groupName && !optionName) return null;

      return {
        groupId: cleanText(modifier.groupId ?? modifier.group_id) || null,
        optionId: cleanText(modifier.optionId ?? modifier.option_id) || null,
        groupName: groupName || "Complemento",
        optionName: optionName || "Opção",
        optionPrice: Number.isFinite(optionPrice) ? optionPrice : 0,
      };
    })
    .filter((modifier): modifier is OrderItemModifier => Boolean(modifier));
}

function formatOrderItemModifier(modifier: OrderItemModifier) {
  const price =
    modifier.optionPrice > 0 ? ` +${formatBRL(modifier.optionPrice)}` : "";

  return `${modifier.groupName}: ${modifier.optionName}${price}`;
}

function getSafeOrderItemModifiers(item: OrderItem) {
  return Array.isArray(item.modifiers) ? item.modifiers : [];
}

function getOrderItemPrintName(item: OrderItem) {
  const modifierLines = getSafeOrderItemModifiers(item).map(
    (modifier) => `  · ${formatOrderItemModifier(modifier)}`,
  );

  const notesLine = item.notes ? [`  Obs: ${item.notes}`] : [];

  return [item.name, ...modifierLines, ...notesLine].join("\n");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Não informado";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayInputDate() {
  return formatInputDate(new Date());
}

function getYesterdayInputDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);

  return formatInputDate(date);
}

function getLastSevenDaysInputDate() {
  const date = new Date();
  date.setDate(date.getDate() - 6);

  return formatInputDate(date);
}

function getDateStartIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function getDateEndIso(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function formatElapsedTime(value: string, nowMs: number) {
  const createdAt = new Date(value).getTime();
  const diffInMinutes = Math.max(0, Math.floor((nowMs - createdAt) / 60000));

  if (diffInMinutes < 1) return "agora";
  if (diffInMinutes < 60) return `${diffInMinutes}min`;

  const hours = Math.floor(diffInMinutes / 60);
  const minutes = diffInMinutes % 60;

  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getOrderNumber(order: OrderRow) {
  if (
    order.public_order_number !== null &&
    order.public_order_number !== undefined
  ) {
    return String(order.public_order_number);
  }

  return order.id.slice(0, 8);
}
function getCustomerName(order: OrderRow) {
  return order.customer_name?.trim() || "Cliente sem nome";
}

function getCustomerPhone(order: OrderRow) {
  return order.customer_phone?.trim() || "Sem telefone";
}

function getOrderTextField(order: OrderRow, keys: string[]) {
  const rawOrder = order as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = rawOrder[key];

    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }

  return null;
}

function getOrderCpf(order: OrderRow) {
  return getOrderTextField(order, [
    "customer_cpf",
    "customer_document",
    "customer_tax_id",
    "document",
    "cpf",
    "tax_id",
  ]);
}

function getOrderNeighborhood(order: OrderRow) {
  return getOrderTextField(order, [
    "customer_neighborhood",
    "delivery_neighborhood",
    "shipping_neighborhood",
    "neighborhood",
    "bairro",
  ]);
}

function getOrderAddress(order: OrderRow) {
  const directAddress = getOrderTextField(order, [
    "customer_address",
    "delivery_address",
    "delivery_full_address",
    "full_address",
    "address",
    "shipping_address",
  ]);

  const street = getOrderTextField(order, [
    "customer_street",
    "delivery_street",
    "street",
    "shipping_street",
  ]);

  const number = getOrderTextField(order, [
    "customer_number",
    "delivery_number",
    "address_number",
    "number",
  ]);

  const neighborhood = getOrderNeighborhood(order);

  const complement = getOrderTextField(order, [
    "customer_complement",
    "delivery_complement",
    "complement",
  ]);

  const city = getOrderTextField(order, [
    "customer_city",
    "delivery_city",
    "city",
  ]);

  const state = getOrderTextField(order, [
    "customer_state",
    "delivery_state",
    "state",
    "uf",
  ]);

  const postalCode = getOrderTextField(order, [
    "customer_postal_code",
    "delivery_postal_code",
    "postal_code",
    "zip_code",
    "zipcode",
    "cep",
  ]);

  const reference = getOrderTextField(order, [
    "customer_reference",
    "delivery_reference",
    "address_reference",
    "reference",
  ]);

  const directAddressHasNumber =
    directAddress &&
    number &&
    directAddress.toLocaleLowerCase("pt-BR").includes(
      number.toLocaleLowerCase("pt-BR"),
    );

  const mainAddress = directAddress
    ? [directAddress, directAddressHasNumber ? null : number]
        .filter(Boolean)
        .join(", ")
    : [street, number].filter(Boolean).join(", ");

  const normalizedMainAddress = mainAddress.toLocaleLowerCase("pt-BR");
  const details: string[] = [];

  const addDetail = (value: string | null, prefix = "") => {
    if (!value) return;
    if (normalizedMainAddress.includes(value.toLocaleLowerCase("pt-BR"))) {
      return;
    }

    details.push(`${prefix}${value}`);
  };

  addDetail(neighborhood);
  addDetail(complement);

  const cityAndState = [city, state].filter(Boolean).join(" - ");
  addDetail(cityAndState || null);
  addDetail(postalCode, "CEP ");
  addDetail(reference, "Ref.: ");

  const fullAddress = [mainAddress, ...details]
    .filter(Boolean)
    .join(" · ");

  return fullAddress || null;
}

function isWhatsAppAiOrder(order: OrderRow) {
  const source = String(order.order_source || order.source || "")
    .trim()
    .toLowerCase();

  return source === "whatsapp_ai";
}

function getCleanOrderNote(note: string | null | undefined) {
  const value = note?.trim();

  if (!value) return null;

  const normalized = value.toLowerCase();

  if (
    normalized.includes("pedido criado pela ia") ||
    normalized.includes("pedido criado por ia") ||
    normalized.includes("pedido criado pelo assistente") ||
    normalized.includes("pedido criado pela ia do whatsapp") ||
    normalized.includes("ai draft")
  ) {
    return "Pedido criado por IA";
  }

  return value;
}

function buildPrintNotes(order: OrderRow) {
  if (isWhatsAppAiOrder(order)) return "Pedido criado por IA";

  return getCleanOrderNote(order.notes);
}

function getAcceptDeadline(order: OrderRow) {
  const createdAt = new Date(order.created_at);

  return new Date(createdAt.getTime() + 20 * 1000);
}

function getPreparationBaseTime(order: OrderRow) {
  return order.preparation_started_at || order.accepted_at || order.created_at;
}

function getPreparationDeadline(
  order: OrderRow,
  averagePrepTimeMinutes: number,
) {
  const base = new Date(getPreparationBaseTime(order));

  return new Date(base.getTime() + averagePrepTimeMinutes * 60 * 1000);
}

function getDeliveryPersonName(
  deliveryPeople: DeliveryPerson[],
  deliveryPersonId: string | null,
) {
  if (!deliveryPersonId) return null;

  return (
    deliveryPeople.find((person) => person.id === deliveryPersonId)?.name ||
    null
  );
}

function getPaymentLabel(paymentMethod: string | null) {
  if (!paymentMethod) return "Não informado";

  const normalized = normalizeStatus(paymentMethod);

  if (normalized === "pix") return "Pix automático";
  if (normalized === "efi_pix") return "Pix automático";
  if (isManualPixMethod(normalized)) return "Pix direto";

  if (
    normalized === "cash" ||
    normalized === "dinheiro" ||
    normalized === "cash_on_delivery"
  ) {
    return "Dinheiro";
  }

  if (normalized === "dinheiro_na_entrega") return "Dinheiro";
  if (normalized === "card_on_delivery") return "Cartão na entrega";

  if (
    normalized === "credit_card" ||
    normalized === "credito" ||
    normalized === "credit_card_on_delivery"
  ) {
    return "Crédito";
  }

  if (
    normalized === "debit_card" ||
    normalized === "debito" ||
    normalized === "debit_card_on_delivery"
  ) {
    return "Débito";
  }

  if (normalized === "mesa") return "Mesa";

  if (normalized === "pending" || normalized === "pendente") {
    return "A confirmar";
  }

  if (
    normalized === "waiting_payment" ||
    normalized === "awaiting_payment"
  ) {
    return "Aguardando pagamento";
  }

  if (normalized === "waiting_customer_payment") {
    return "Aguardando pagamento";
  }

  return paymentMethod;
}

function isCashPaymentMethod(paymentMethod: string | null | undefined) {
  const normalized = normalizeStatus(paymentMethod);

  return (
    normalized === "cash" ||
    normalized === "dinheiro" ||
    normalized === "cash_on_delivery" ||
    normalized === "dinheiro_na_entrega"
  );
}

function getOrderChangeFor(order: OrderRow) {
  const changeFor = Number(order.change_for || 0);

  if (!Number.isFinite(changeFor) || changeFor <= 0) return 0;

  return changeFor;
}

function getOrderChangeAmount(order: OrderRow) {
  const changeFor = getOrderChangeFor(order);
  const total = Number(order.total || 0);

  if (changeFor <= 0 || !Number.isFinite(total)) return 0;

  return Math.max(changeFor - total, 0);
}

function getPaymentStatusLabel(paymentStatus: string | null) {
  const normalized = normalizeStatus(paymentStatus);

  if (!normalized) return "Não informado";

  if (
    normalized === "paid" ||
    normalized === "pago" ||
    normalized === "approved" ||
    normalized === "confirmed"
  ) {
    return "Pago";
  }

  if (
    normalized === "awaiting_pix_confirmation" ||
    normalized === "awaiting_review" ||
    normalized === "aguardando_conferencia" ||
    normalized === "aguardando conferência" ||
    normalized === "waiting_pix_confirmation" ||
    normalized === "awaiting_pix_review" ||
    normalized === "aguardando_confirmacao_pix" ||
    normalized === "aguardando confirmação pix"
  ) {
    return "Aguardando conferência";
  }

  if (
    normalized === "waiting_customer_payment" ||
    normalized === "waiting_payment" ||
    normalized === "awaiting_payment" ||
    normalized === "aguardando_pagamento" ||
    normalized === "aguardando pagamento"
  ) {
    return "Aguardando pagamento";
  }

  if (
    normalized === "pending" ||
    normalized === "pendente" ||
    normalized === "open" ||
    normalized === "created"
  ) {
    return "Pendente";
  }

  if (
    normalized === "failed" ||
    normalized === "falhou" ||
    normalized === "erro"
  ) {
    return "Falhou";
  }

  if (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelado"
  ) {
    return "Cancelado";
  }

  if (
    normalized === "refunded" ||
    normalized === "reembolsado"
  ) {
    return "Reembolsado";
  }

  return paymentStatus;
}

function isFinishedOrderStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  return (
    normalized === "delivered" ||
    normalized === "completed" ||
    normalized === "finalizado" ||
    normalized === "finalizada" ||
    normalized === "finished"
  );
}

function isCancelledOrderStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  return (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelado" ||
    normalized === "cancelada"
  );
}

function isPaidPaymentStatus(paymentStatus: string | null | undefined) {
  const normalized = normalizeStatus(paymentStatus);

  return (
    normalized === "paid" ||
    normalized === "pago" ||
    normalized === "approved" ||
    normalized === "confirmed"
  );
}

function isCancelledPaymentStatus(
  paymentStatus: string | null | undefined,
) {
  const normalized = normalizeStatus(paymentStatus);

  return (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelado" ||
    normalized === "cancelada" ||
    normalized === "failed" ||
    normalized === "falhou"
  );
}

function isPendingPaymentStatus(
  paymentStatus: string | null | undefined,
) {
  return (
    !isPaidPaymentStatus(paymentStatus) &&
    !isCancelledPaymentStatus(paymentStatus)
  );
}

function getOrderStatusLabel(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  if (isPixWaitingStatus(normalized)) return "Aguardando Pix";
  if (isAnalysisStatus(normalized)) return "Pendente";
  if (isPreparationStatus(normalized)) return "Em preparo";
  if (isReadyStatus(normalized)) return "Pronto";

  if (
    normalized === "out_for_delivery" ||
    normalized === "em_rota" ||
    normalized === "em rota"
  ) {
    return "Em rota";
  }

  if (isFinishedOrderStatus(normalized)) return "Finalizado";
  if (isCancelledOrderStatus(normalized)) return "Cancelado";

  if (
    normalized === "waiting_payment" ||
    normalized === "awaiting_payment"
  ) {
    return "Aguardando pagamento";
  }

  return status || "Não informado";
}

function getOrderStatusBadgeClasses(
  status: string | null | undefined,
) {
  if (isFinishedOrderStatus(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (isCancelledOrderStatus(status)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (isPixWaitingStatus(status)) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (isReadyStatus(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (isPreparationStatus(status)) {
    return "border-neutral-300 bg-neutral-50 text-neutral-900";
  }

  return "border-orange-200 bg-orange-50 text-orange-700";
}

function matchesHistoryStatus(
  order: OrderRow,
  filter: HistoryStatusFilter,
) {
  if (filter === "all") return true;
  if (filter === "open") return getBoardStatus(order.status) !== null;
  if (filter === "finished") return isFinishedOrderStatus(order.status);
  if (filter === "cancelled") return isCancelledOrderStatus(order.status);

  return true;
}

function matchesHistoryPaymentStatus(
  order: OrderRow,
  filter: HistoryPaymentStatusFilter,
) {
  if (filter === "all") return true;
  if (filter === "paid") return isPaidPaymentStatus(order.payment_status);
  if (filter === "pending") return isPendingPaymentStatus(order.payment_status);

  if (filter === "cancelled") {
    return isCancelledPaymentStatus(order.payment_status);
  }

  return true;
}

function formatHistoryItemsSummary(items: OrderItem[]) {
  if (items.length === 0) return "Itens não carregados";

  const preview = items
    .slice(0, 2)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ");

  if (items.length <= 2) return preview;

  return `${preview} +${items.length - 2}`;
}

function isDeliveryOrder(order: OrderRow) {
  const deliveryFee = Number(order.delivery_fee || 0);
  const paymentMethod = normalizeStatus(order.payment_method);
  const customerName = normalizeStatus(order.customer_name);
  const notes = normalizeStatus(order.notes);

  const isLocalOrPickup =
    paymentMethod === "mesa" ||
    customerName.includes("mesa") ||
    notes.includes("retirada") ||
    notes.includes("retirar") ||
    notes.includes("balcao") ||
    notes.includes("balcão") ||
    notes.includes("pedido local") ||
    notes.includes("mesa") ||
    notes.includes("comanda") ||
    notes.includes("consumo local");

  if (isLocalOrPickup) return false;

  const hasDeliverySignal =
    deliveryFee > 0 ||
    Boolean(order.delivery_person_id) ||
    notes.includes("delivery") ||
    notes.includes("entrega") ||
    notes.includes("entregar") ||
    notes.includes("endereco") ||
    notes.includes("endereço") ||
    notes.includes("bairro") ||
    notes.includes("rua");

  return hasDeliverySignal;
}

function getOrderTypeLabel(order: OrderRow) {
  const paymentMethod = normalizeStatus(order.payment_method);
  const customerName = normalizeStatus(order.customer_name);

  if (
    paymentMethod === "mesa" ||
    customerName.includes("mesa")
  ) {
    return "Mesa";
  }

  return isDeliveryOrder(order) ? "Entrega" : "Retirada";
}

function normalizeOrderItem(
  raw: Record<string, unknown>,
): OrderItem {
  const quantity = Number(raw.quantity || raw.qty || 1);

  const total = Number(
    raw.total_price ||
      raw.subtotal ||
      raw.total ||
      raw.price ||
      raw.unit_price ||
      0,
  );

  const name =
    String(
      raw.product_name ||
        raw.menu_item_name ||
        raw.item_name ||
        raw.name ||
        "Item do pedido",
    ) || "Item do pedido";

  return {
    id: String(raw.id || crypto.randomUUID()),
    order_id: String(raw.order_id || ""),
    product_id:
      raw.product_id === null || raw.product_id === undefined
        ? null
        : String(raw.product_id),
    name,
    quantity,
    total,
    notes:
      raw.notes === null || raw.notes === undefined
        ? null
        : String(raw.notes),
    modifiers: normalizeOrderItemModifiers(raw.modifiers),
    stock_deducted_at:
      raw.stock_deducted_at === null ||
      raw.stock_deducted_at === undefined
        ? null
        : String(raw.stock_deducted_at),
  };
}

function toPrintNumber(
  value: number | string | null | undefined,
) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) return 0;

  return number;
}

function getRestaurantPrintData(restaurant: unknown) {
  const data = restaurant as {
    name?: string | null;
    logo_url?: string | null;
    logoUrl?: string | null;
    phone?: string | null;
    address?: string | null;
  };

  return {
    name: data?.name?.trim() || "Restaurante",
    logoUrl: data?.logo_url || data?.logoUrl || null,
    phone: data?.phone || null,
    address: data?.address || null,
  };
}

function getThermalOrderType(order: OrderRow) {
  return isDeliveryOrder(order) ? "delivery" : "pickup";
}

function buildThermalOrderPayload(
  order: OrderRow,
  items: OrderItem[],
): ThermalPrintOrder {
  const deliveryAddress = getOrderAddress(order);
  const customerCpf = getOrderCpf(order);

  const street = getOrderTextField(order, [
    "customer_street",
    "delivery_street",
    "street",
    "shipping_street",
  ]);

  const number = getOrderTextField(order, [
    "customer_number",
    "delivery_number",
    "address_number",
    "number",
  ]);

  const neighborhood = getOrderNeighborhood(order);

  const complement = getOrderTextField(order, [
    "customer_complement",
    "delivery_complement",
    "complement",
  ]);

  const reference = getOrderTextField(order, [
    "customer_reference",
    "delivery_reference",
    "address_reference",
    "reference",
  ]);

  return {
    id: order.id,
    publicOrderNumber: getOrderNumber(order),
    type: getThermalOrderType(order),
    createdAt: order.created_at,
    customer: {
      name: getCustomerName(order),
      phone: getCustomerPhone(order),
      cpf: customerCpf,
      document: customerCpf,
      address: deliveryAddress,
      street,
      number,
      neighborhood,
      complement,
      reference,
    },
    items: items.map((item) => ({
      name: getOrderItemPrintName(item),
      quantity: item.quantity,
      price:
        item.quantity > 0
          ? item.total / item.quantity
          : item.total,
    })),
    notes: buildPrintNotes(order),
    subtotal: toPrintNumber(order.subtotal),
    deliveryFee: toPrintNumber(order.delivery_fee),
    discount: toPrintNumber(order.discount),
    total: toPrintNumber(order.total),
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    needsChange: Boolean(order.needs_change),
    changeFor: getOrderChangeFor(order) || null,
  };
}
type OrderCardProps = {
  order: OrderRow;
  status: BoardStatus;
  items: OrderItem[];
  deliveryPeople: DeliveryPerson[];
  averagePrepTimeMinutes: number;
  nowMs: number;
  busyOrderId: string | null;
  kdsEnabled: boolean;
  onAccept: (order: OrderRow) => void;
  onCancel: (order: OrderRow) => void;
  onMarkReady: (order: OrderRow) => void;
  onSendToRoute: (
    order: OrderRow,
    deliveryPersonId: string,
  ) => void;
  onFinish: (order: OrderRow) => void;
  onPrint: (
    order: OrderRow,
    items: OrderItem[],
    mode: ThermalPrintMode,
  ) => void;
};

function OrderCard({
  order,
  status,
  items,
  deliveryPeople,
  averagePrepTimeMinutes,
  nowMs,
  busyOrderId,
  kdsEnabled,
  onAccept,
  onCancel,
  onMarkReady,
  onSendToRoute,
  onFinish,
  onPrint,
}: OrderCardProps) {
  const isBusy = busyOrderId === order.id;
  const isDelivery = isDeliveryOrder(order);
  const isPixReview = isPixAwaitingReview(order);
  const deliveryAddress = getOrderAddress(order);
  const neighborhood = getOrderNeighborhood(order);
  const customerCpf = getOrderCpf(order);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false);
  const [selectedDeliveryPersonId, setSelectedDeliveryPersonId] = useState(
    order.delivery_person_id || "",
  );

  const acceptDeadline = getAcceptDeadline(order);
  const acceptRemainingMs = acceptDeadline.getTime() - nowMs;
  const acceptRemainingSeconds = Math.max(
    0,
    Math.ceil(acceptRemainingMs / 1000),
  );
  const acceptDelaySeconds = Math.max(
    0,
    Math.floor(Math.abs(acceptRemainingMs) / 1000),
  );

  const preparationDeadline = getPreparationDeadline(
    order,
    averagePrepTimeMinutes,
  );

  const preparationRemainingMs =
    preparationDeadline.getTime() - nowMs;

  const isLate =
    (status === "analysis" && acceptRemainingMs <= 0) ||
    (status === "preparation" && preparationRemainingMs <= 0);

  const showCashChange =
    isCashPaymentMethod(order.payment_method) &&
    order.needs_change &&
    getOrderChangeFor(order) > 0;

  const isAiOrder = isWhatsAppAiOrder(order);
  const cleanOrderNote = getCleanOrderNote(order.notes);
  const previewItems = items.slice(0, 3);
  const hiddenItemsCount = Math.max(
    0,
    items.length - previewItems.length,
  );

  const primaryActionLabel =
    status === "analysis"
      ? "Aceitar pedido"
      : status === "preparation"
        ? "Marcar pronto"
        : "Finalizar pedido";

  const handlePrimaryAction = () => {
    if (status === "analysis") {
      onAccept(order);
      return;
    }

    if (status === "preparation") {
      onMarkReady(order);
      return;
    }

    if (isDelivery) {
      setDeliveryPickerOpen(true);
      return;
    }

    onFinish(order);
  };

  const handleFinishDelivery = () => {
    onSendToRoute(order, selectedDeliveryPersonId);
    setDeliveryPickerOpen(false);
  };

  const primaryActionDisabled =
    isBusy || (status === "preparation" && kdsEnabled);

  const elapsedLabel =
    status === "analysis"
      ? acceptRemainingMs > 0
        ? `${acceptRemainingSeconds}s para aceitar`
        : `atrasado há ${acceptDelaySeconds}s`
      : status === "preparation"
        ? preparationRemainingMs > 0
          ? `${Math.ceil(preparationRemainingMs / 60000)} min restantes`
          : "atrasado"
        : `pronto há ${formatElapsedTime(
            order.preparation_started_at ||
              order.accepted_at ||
              order.created_at,
            nowMs,
          )}`;

  return (
    <>
      <article
        className={[
          "overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md",
          isLate
            ? "border-red-500 !bg-red-50 ring-2 ring-red-200"
            : "border-neutral-200 hover:border-neutral-400",
        ].join(" ")}
      >
        <div
          className={[
            "h-1",
            isLate
              ? "bg-red-500"
              : status === "analysis"
                ? "bg-[#f97316]"
                : status === "preparation"
                  ? "bg-[#111111]"
                  : "bg-emerald-500",
          ].join(" ")}
        />

        {status === "analysis" && isLate && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-red-700">
            <Clock3 className="h-4 w-4 shrink-0" />
            <p className="text-xs font-black uppercase tracking-wide">
              Pedido atrasado · aguardando aceite
            </p>
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-900">
                  #{getOrderNumber(order)}
                </h3>

                <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#111111]">
                  {getOrderTypeLabel(order)}
                </span>

                {isAiOrder && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#111111]">
                    <Bot className="h-3 w-3" />
                    IA
                  </span>
                )}
              </div>

              <p className="mt-2 truncate text-sm font-black text-slate-900">
                {getCustomerName(order)}
              </p>

              <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                {getCustomerPhone(order)}
              </p>

              {isDelivery ? (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f97316]" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Endereço de entrega
                    </p>
                    <p className="mt-0.5 line-clamp-3 font-bold leading-relaxed">
                      {deliveryAddress || "Endereço não informado"}
                    </p>
                  </div>
                </div>
              ) : (
                neighborhood && (
                  <p className="mt-1 flex items-center gap-1 truncate text-xs font-bold text-slate-600">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#f97316]" />
                    <span className="truncate">{neighborhood}</span>
                  </p>
                )
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="text-lg font-black text-slate-900">
                {formatBRL(order.total)}
              </p>

              <p
                className={[
                  "mt-1 text-xs font-black",
                  isLate ? "text-red-600" : "text-slate-500",
                ].join(" ")}
              >
                {elapsedLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/40 px-3 py-2.5">
            {previewItems.length > 0 ? (
              <div className="space-y-1.5">
                {previewItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <p className="min-w-0 font-bold text-slate-700">
                      <span className="font-black text-[#111111]">
                        {item.quantity}x
                      </span>{" "}
                      {item.name}
                    </p>

                    {item.total > 0 && (
                      <p className="shrink-0 text-xs font-black text-slate-600">
                        {formatBRL(item.total)}
                      </p>
                    )}
                  </div>
                ))}

                {hiddenItemsCount > 0 && (
                  <p className="text-xs font-bold text-slate-500">
                    + {hiddenItemsCount}{" "}
                    {hiddenItemsCount === 1 ? "item" : "itens"}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                Itens ainda não carregados.
              </p>
            )}
          </div>

          <div className="mt-3 border-b border-neutral-200 pb-3">
            <div>
              <p className="text-xs font-black text-slate-800">
                {getPaymentLabel(order.payment_method)}
              </p>

              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                {getPaymentStatusLabel(order.payment_status)}
              </p>
            </div>
          </div>

          {isPixReview && status === "analysis" && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-black text-amber-900">
                Pagamento via Pix
              </p>

              <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-800">
                Confira o comprovante no WhatsApp antes de aceitar. Se
                não houver pagamento, cancele o pedido.
              </p>
            </div>
          )}

          {showCashChange && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-black text-amber-900">
                Troco para {formatBRL(getOrderChangeFor(order))}
              </p>

              <p className="mt-0.5 text-xs font-semibold text-amber-800">
                Separar {formatBRL(getOrderChangeAmount(order))} de
                troco.
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-[auto_minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
            <button
              type="button"
              onClick={() => onPrint(order, items, "receipt")}
              title="Imprimir pedido"
              aria-label="Imprimir pedido"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-[#111111] transition hover:border-neutral-400 hover:bg-neutral-50"
            >
              <Printer className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => onCancel(order)}
              disabled={isBusy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Cancelar
            </button>

            {status === "preparation" && kdsEnabled ? (
              <div className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm font-black text-[#111111]">
                KDS controla o preparo
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={primaryActionDisabled}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#111111] px-3 text-sm font-black text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : status === "ready" && isDelivery ? (
                  <Truck className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}

                {primaryActionLabel}
              </button>
            )}
          </div>

          {status === "ready" && isDelivery && deliveryPickerOpen && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                  <Truck className="h-4 w-4" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900">
                    Quem fará a entrega?
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Selecione o motoboy antes de concluir.
                  </p>
                </div>
              </div>

              <select
                value={selectedDeliveryPersonId}
                onChange={(event) =>
                  setSelectedDeliveryPersonId(event.target.value)
                }
                disabled={isBusy || deliveryPeople.length === 0}
                className="mt-2.5 h-9 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                aria-label="Selecionar motoboy"
              >
                <option value="">
                  {deliveryPeople.length === 0
                    ? "Nenhum motoboy cadastrado"
                    : "Selecione um motoboy"}
                </option>

                {deliveryPeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.phone ? ` · ${person.phone}` : ""}
                  </option>
                ))}
              </select>

              <div className="mt-2.5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryPickerOpen(false)}
                  disabled={isBusy}
                  className="h-8 px-2 text-xs font-black text-slate-500 transition hover:text-slate-900 disabled:opacity-50"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={handleFinishDelivery}
                  disabled={isBusy || !selectedDeliveryPersonId}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Confirmar finalização
                </button>
              </div>
            </div>
          )}
        </div>
      </article>

      {detailsOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
            <div
              className="absolute inset-0"
              onClick={() => setDetailsOpen(false)}
              aria-hidden="true"
            />

            <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#111111]">
                    Pedido #{getOrderNumber(order)}
                  </p>

                  <h3 className="mt-1 text-xl font-black text-slate-900">
                    {getCustomerName(order)}
                  </h3>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {getCustomerPhone(order)} ·{" "}
                    {getOrderTypeLabel(order)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-[#111111] transition hover:border-neutral-300 hover:bg-neutral-200"
                  aria-label="Fechar detalhes"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f5f5f5] p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#111111]">
                      Pagamento
                    </p>

                    <p className="mt-1 text-sm font-black text-slate-900">
                      {getPaymentLabel(order.payment_method)}
                    </p>

                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      {getPaymentStatusLabel(
                        order.payment_status,
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#111111]">
                      Tipo
                    </p>

                    <p className="mt-1 text-sm font-black text-slate-900">
                      {getOrderTypeLabel(order)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#111111]">
                      Total
                    </p>

                    <p className="mt-1 text-lg font-black text-slate-900">
                      {formatBRL(order.total)}
                    </p>
                  </div>
                </div>

                {isPixReview && status === "analysis" && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-amber-900">
                      Confira o Pix antes do aceite
                    </p>

                    <p className="mt-1 text-sm font-semibold leading-relaxed text-amber-800">
                      Verifique o comprovante na conversa do
                      WhatsApp. Aceitar o pedido também registra o
                      pagamento como conferido.
                    </p>
                  </div>
                )}

                {(deliveryAddress || customerCpf) && (
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#111111]">
                      Cliente e entrega
                    </p>

                    {deliveryAddress && (
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                        <span className="font-black text-slate-900">
                          Endereço:
                        </span>{" "}
                        {deliveryAddress}
                      </p>
                    )}

                    {customerCpf && (
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        <span className="font-black text-slate-900">
                          CPF:
                        </span>{" "}
                        {customerCpf}
                      </p>
                    )}
                  </div>
                )}

                {showCashChange && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-amber-900">
                      Troco
                    </p>

                    <p className="mt-1 text-sm font-semibold text-amber-800">
                      Troco para{" "}
                      {formatBRL(getOrderChangeFor(order))} ·
                      separar{" "}
                      {formatBRL(getOrderChangeAmount(order))}.
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-neutral-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#111111]">
                      Itens
                    </p>

                    <span className="text-xs font-black text-slate-500">
                      {formatItemCount(items.length)}
                    </span>
                  </div>

                  {items.length > 0 ? (
                    <div className="divide-y divide-neutral-200">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="py-2.5 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900">
                                <span className="text-[#111111]">
                                  {item.quantity}x
                                </span>{" "}
                                {item.name}
                              </p>

                              {getSafeOrderItemModifiers(
                                item,
                              ).map((modifier, index) => (
                                <p
                                  key={`${
                                    modifier.groupId ??
                                    modifier.groupName
                                  }-${
                                    modifier.optionId ??
                                    modifier.optionName
                                  }-${index}`}
                                  className="mt-0.5 text-xs font-semibold text-slate-500"
                                >
                                  ·{" "}
                                  {formatOrderItemModifier(
                                    modifier,
                                  )}
                                </p>
                              ))}

                              {item.notes && (
                                <p className="mt-1 text-xs font-semibold text-[#f97316]">
                                  Obs: {item.notes}
                                </p>
                              )}
                            </div>

                            {item.total > 0 && (
                              <p className="shrink-0 text-sm font-black text-slate-900">
                                {formatBRL(item.total)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-neutral-200 p-3 text-sm text-slate-500">
                      Itens do pedido não carregados.
                    </p>
                  )}
                </div>

                {(cleanOrderNote || isAiOrder) && (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#111111]">
                      {isAiOrder ? "Origem" : "Observação"}
                    </p>

                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold leading-relaxed text-slate-600">
                      {isAiOrder && (
                        <Bot className="h-4 w-4 text-[#111111]" />
                      )}

                      {isAiOrder
                        ? "Pedido criado por IA"
                        : cleanOrderNote}
                    </p>
                  </div>
                )}

              </div>

              <div className="border-t border-neutral-200 bg-white p-3">
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  {status !== "analysis" && (
                    <button
                      type="button"
                      onClick={() =>
                        onPrint(order, items, "kitchen")
                      }
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-black text-[#111111] transition hover:bg-neutral-50"
                    >
                      <ChefHat className="h-4 w-4" />
                      Cozinha
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onPrint(order, items, "receipt")
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-black text-[#111111] transition hover:bg-neutral-50"
                  >
                    <Printer className="h-4 w-4" />
                    Recibo
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDetailsOpen(false);
                      onCancel(order);
                    }}
                    disabled={isBusy}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar
                  </button>

                  {status === "preparation" && kdsEnabled ? (
                    <div className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs font-black text-[#111111]">
                      KDS controlando
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        handlePrimaryAction();
                        setDetailsOpen(false);
                      }}
                      disabled={primaryActionDisabled}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#111111] px-3 text-xs font-black text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : status === "ready" && isDelivery ? (
                        <Truck className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}

                      {primaryActionLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

type BoardColumnProps = {
  status: BoardStatus;
  orders: OrderRow[];
  orderItemsByOrderId: Record<string, OrderItem[]>;
  deliveryPeople: DeliveryPerson[];
  averagePrepTimeMinutes: number;
  nowMs: number;
  busyOrderId: string | null;
  kdsEnabled: boolean;
  onAccept: (order: OrderRow) => void;
  onCancel: (order: OrderRow) => void;
  onMarkReady: (order: OrderRow) => void;
  onSendToRoute: (
    order: OrderRow,
    deliveryPersonId: string,
  ) => void;
  onFinish: (order: OrderRow) => void;
  onPrint: (
    order: OrderRow,
    items: OrderItem[],
    mode: ThermalPrintMode,
  ) => void;
};
function BoardColumn({
  status,
  orders,
  orderItemsByOrderId,
  deliveryPeople,
  averagePrepTimeMinutes,
  nowMs,
  busyOrderId,
  kdsEnabled,
  onAccept,
  onCancel,
  onMarkReady,
  onSendToRoute,
  onFinish,
  onPrint,
}: BoardColumnProps) {
  const styles = columnStyles[status]
  const Icon = styles.icon as typeof Clock3

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-white px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.accent}`}
            />

            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight text-slate-900">
                {styles.title as string}
              </h2>

              <p className="truncate text-xs font-semibold text-slate-500">
                {styles.description as string}
              </p>
            </div>
          </div>

          <span
            className={`flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-xs font-black ${styles.badge}`}
          >
            {orders.length}
          </span>
        </div>
      </div>

      <div
        className={`${styles.body} min-h-[calc(100vh-250px)] space-y-3 p-3`}
      >
        {orders.length === 0 ? (
          <div className="flex min-h-[165px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white p-5 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-[#111111]">
                <Icon className="h-5 w-5" />
              </div>

              <p className="text-sm font-black text-slate-900">
                Nenhum pedido
              </p>

              <p className="mt-1 max-w-[220px] text-xs font-semibold leading-relaxed text-slate-500">
                Os pedidos dessa etapa aparecem aqui automaticamente.
              </p>
            </div>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              status={status}
              items={orderItemsByOrderId[order.id] || []}
              deliveryPeople={deliveryPeople}
              averagePrepTimeMinutes={averagePrepTimeMinutes}
              nowMs={nowMs}
              busyOrderId={busyOrderId}
              kdsEnabled={kdsEnabled}
              onAccept={onAccept}
              onCancel={onCancel}
              onMarkReady={onMarkReady}
              onSendToRoute={onSendToRoute}
              onFinish={onFinish}
              onPrint={onPrint}
            />
          ))
        )}
      </div>
    </section>
  )
}

type HistoryOrderDetailsModalProps = {
  order: OrderRow
  items: OrderItem[]
  deliveryPeople: DeliveryPerson[]
  onClose: () => void
}

function HistoryOrderDetailsModal({
  order,
  items,
  deliveryPeople,
  onClose,
}: HistoryOrderDetailsModalProps) {
  const deliveryAddress = getOrderAddress(order)
  const neighborhood = getOrderNeighborhood(order)
  const deliveryPersonName = getDeliveryPersonName(
    deliveryPeople,
    order.delivery_person_id,
  )

  const subtotal = Number(order.subtotal || 0)
  const discount = Number(order.discount || 0)
  const deliveryFee = Number(order.delivery_fee || 0)
  const total = Number(order.total || 0)

  const calculatedItemsTotal = items.reduce(
    (sum, item) => sum + Number(item.total || 0),
    0,
  )

  const shownSubtotal =
    subtotal > 0 ? subtotal : calculatedItemsTotal

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
              Histórico do pedido
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-zinc-950">
                Pedido #{getOrderNumber(order)}
              </h3>

              <span
                className={[
                  "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                  getOrderStatusBadgeClasses(order.status),
                ].join(" ")}
              >
                {getOrderStatusLabel(order.status)}
              </span>
            </div>

            <p className="mt-1 text-xs font-semibold text-zinc-500">
              Criado em {formatDateTime(order.created_at)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-500 transition hover:border-amber-400 hover:text-zinc-950"
            aria-label="Fechar histórico"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <User className="h-4 w-4 text-amber-700" />

                <p className="text-[10px] font-black uppercase tracking-wide">
                  Cliente
                </p>
              </div>

              <p className="mt-2 text-sm font-black text-zinc-950">
                {getCustomerName(order)}
              </p>

              <p className="mt-1 text-xs font-semibold text-zinc-500">
                {getCustomerPhone(order)}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <CreditCard className="h-4 w-4 text-amber-700" />

                <p className="text-[10px] font-black uppercase tracking-wide">
                  Pagamento
                </p>
              </div>

              <p className="mt-2 text-sm font-black text-zinc-950">
                {getPaymentLabel(order.payment_method)}
              </p>

              <p className="mt-1 text-xs font-semibold text-zinc-500">
                {getPaymentStatusLabel(order.payment_status)}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <Truck className="h-4 w-4 text-amber-700" />

                <p className="text-[10px] font-black uppercase tracking-wide">
                  Entrega
                </p>
              </div>

              <p className="mt-2 text-sm font-black text-zinc-950">
                {getOrderTypeLabel(order)}
              </p>

              <p className="mt-1 text-xs font-semibold text-zinc-500">
                Taxa: {formatBRL(order.delivery_fee)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <MapPin className="h-4 w-4 text-amber-700" />

                <p className="text-[10px] font-black uppercase tracking-wide">
                  Endereço e bairro
                </p>
              </div>

              <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-600">
                <span className="font-black text-zinc-950">
                  Endereço:
                </span>{" "}
                {deliveryAddress || "Não informado"}
              </p>

              <p className="mt-1 text-sm font-semibold leading-relaxed text-zinc-600">
                <span className="font-black text-zinc-950">
                  Bairro:
                </span>{" "}
                {neighborhood || "Não informado"}
              </p>

              {deliveryPersonName && (
                <p className="mt-1 text-sm font-semibold leading-relaxed text-zinc-600">
                  <span className="font-black text-zinc-950">
                    Motoboy:
                  </span>{" "}
                  {deliveryPersonName}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                Datas do pedido
              </p>

              <div className="mt-2 space-y-1.5 text-xs font-semibold text-zinc-500">
                <p>
                  Entrada: {formatDateTime(order.created_at)}
                </p>

                {order.accepted_at && (
                  <p>
                    Aceito: {formatDateTime(order.accepted_at)}
                  </p>
                )}

                {order.preparation_started_at && (
                  <p>
                    Preparo:{" "}
                    {formatDateTime(
                      order.preparation_started_at,
                    )}
                  </p>
                )}

                {order.out_for_delivery_at && (
                  <p>
                    Rota:{" "}
                    {formatDateTime(
                      order.out_for_delivery_at,
                    )}
                  </p>
                )}

                {order.delivered_at && (
                  <p>
                    Finalizado:{" "}
                    {formatDateTime(order.delivered_at)}
                  </p>
                )}

                {order.cancelled_at && (
                  <p>
                    Cancelado:{" "}
                    {formatDateTime(order.cancelled_at)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                Itens do pedido
              </p>

              <span className="text-xs font-black text-zinc-500">
                {formatItemCount(items.length)}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="p-4 text-sm font-semibold text-zinc-500">
                Nenhum item carregado para esse pedido.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Produto
                      </th>

                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Qtd
                      </th>

                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Unitário
                      </th>

                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Subtotal
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => {
                      const unitPrice =
                        item.quantity > 0
                          ? item.total / item.quantity
                          : item.total

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-zinc-200 last:border-0"
                        >
                          <td className="px-3 py-3">
                            <p className="text-sm font-black text-zinc-950">
                              {item.name}
                            </p>

                            {getSafeOrderItemModifiers(
                              item,
                            ).map((modifier, index) => (
                              <p
                                key={`${
                                  modifier.groupId ??
                                  modifier.groupName
                                }-${
                                  modifier.optionId ??
                                  modifier.optionName
                                }-${index}`}
                                className="mt-0.5 text-xs font-semibold text-zinc-500"
                              >
                                ·{" "}
                                {formatOrderItemModifier(
                                  modifier,
                                )}
                              </p>
                            ))}

                            {item.notes && (
                              <p className="mt-1 text-xs font-semibold text-amber-700">
                                Obs: {item.notes}
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-3 text-center text-sm font-bold text-zinc-600">
                            {item.quantity}
                          </td>

                          <td className="px-3 py-3 text-right text-sm font-semibold text-zinc-500">
                            {formatBRL(unitPrice)}
                          </td>

                          <td className="px-3 py-3 text-right text-sm font-black text-zinc-950">
                            {formatBRL(item.total)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                Observações
              </p>

              <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-600">
                {buildPrintNotes(order) ||
                  "Nenhuma observação registrada."}
              </p>
            </div>

            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">
                Resumo financeiro
              </p>

              <div className="mt-3 space-y-2 text-sm font-semibold">
                <div className="flex justify-between gap-3 text-zinc-300">
                  <span>Subtotal</span>
                  <span>{formatBRL(shownSubtotal)}</span>
                </div>

                <div className="flex justify-between gap-3 text-zinc-300">
                  <span>Taxa de entrega</span>
                  <span>{formatBRL(deliveryFee)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between gap-3 text-zinc-300">
                    <span>Desconto</span>
                    <span>-{formatBRL(discount)}</span>
                  </div>
                )}

                <div className="border-t border-amber-200 pt-2">
                  <div className="flex justify-between gap-3 text-base font-black text-zinc-950">
                    <span>Total</span>
                    <span>{formatBRL(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {order.pix_proof_url && (
            <a
              href={order.pix_proof_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-black text-amber-700 transition hover:bg-amber-100"
            >
              Ver comprovante Pix
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
export default function PedidosPage() {
  const { restaurant, user, isLoading: authLoading } = useAuth();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItemsByOrderId, setOrderItemsByOrderId] = useState<
    Record<string, OrderItem[]>
  >({});
  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPerson[]>([]);
  const [allDeliveryPeople, setAllDeliveryPeople] = useState<DeliveryPerson[]>(
    [],
  );
  const [averagePrepTimeMinutes, setAveragePrepTimeMinutes] = useState(30);
  const [restaurantPrintData, setRestaurantPrintData] =
    useState<RestaurantPrintData | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<ViewMode>("operation");
  const [search, setSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyOrders, setHistoryOrders] = useState<OrderRow[]>([]);
  const [historyOrderItemsByOrderId, setHistoryOrderItemsByOrderId] = useState<
    Record<string, OrderItem[]>
  >({});
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(
    DEFAULT_HISTORY_FILTERS,
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [selectedHistoryOrder, setSelectedHistoryOrder] =
    useState<OrderRow | null>(null);

  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [savingPrepTime, setSavingPrepTime] = useState(false);
  const [savingAutoAcceptOrders, setSavingAutoAcceptOrders] = useState(false);
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [orderAlertsEnabled, setOrderAlertsEnabled] = useState(false);
  const [kdsEnabled, setKdsEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [newOrderAlert, setNewOrderAlert] = useState<NewOrderAlert | null>(
    null,
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const alertTimeoutRef = useRef<number | null>(null);
  const previousVisibleOrderIdsRef = useRef<Set<string>>(new Set());
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());
  const hasSeededVisibleOrdersRef = useRef(false);

  const resumeOrderAudio = useCallback(async () => {
    const AudioContextConstructor = getAudioContextConstructor();

    if (!AudioContextConstructor) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    audioUnlockedRef.current = audioContextRef.current.state === "running";

    return audioContextRef.current;
  }, []);

  const playNewOrderSound = useCallback(async () => {
    try {
      const audioContext = await resumeOrderAudio();

      if (!audioContext) return false;

      const masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(
        0.42,
        audioContext.currentTime + 0.03,
      );
      masterGain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 1.1,
      );
      masterGain.connect(audioContext.destination);

      const playTone = (
        frequency: number,
        startTime: number,
        duration: number,
      ) => {
        const oscillator = audioContext.createOscillator();
        const toneGain = audioContext.createGain();

        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(frequency, startTime);

        toneGain.gain.setValueAtTime(0.0001, startTime);
        toneGain.gain.exponentialRampToValueAtTime(0.9, startTime + 0.015);
        toneGain.gain.exponentialRampToValueAtTime(
          0.0001,
          startTime + duration,
        );

        oscillator.connect(toneGain);
        toneGain.connect(masterGain);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration + 0.04);
      };

      const start = audioContext.currentTime + 0.02;

      playTone(784, start, 0.2);
      playTone(988, start + 0.24, 0.22);
      playTone(1319, start + 0.5, 0.26);

      audioUnlockedRef.current = true;
      return true;
    } catch (err) {
      console.warn("Não foi possível tocar o alerta sonoro:", err);
      audioUnlockedRef.current = false;
      return false;
    }
  }, [resumeOrderAudio]);

  const disableOrderAlerts = useCallback(() => {
    setOrderAlertsEnabled(false);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("clickfood_order_alerts_enabled");
    }
  }, []);

  const toggleKdsEnabled = useCallback(() => {
    setKdsEnabled((current) => {
      const nextValue = !current;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "clickfood_kds_enabled",
          nextValue ? "true" : "false",
        );
      }

      return nextValue;
    });
  }, []);

  const enableOrderAlerts = useCallback(async () => {
    const soundWorked = await playNewOrderSound();

    if (!soundWorked) {
      setError(
        "O alerta visual foi ativado, mas o navegador não liberou o som. Clique novamente em Ativar alertas e confira se a aba não está mutada.",
      );
    } else {
      setError(null);
    }

    setOrderAlertsEnabled(true);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("clickfood_order_alerts_enabled", "true");
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      } else {
        setNotificationPermission(Notification.permission);
      }
    } else {
      setNotificationPermission("unsupported");
    }
  }, [playNewOrderSound]);

  const showNewOrderAlert = useCallback(
    (order: OrderRow) => {
      if (!order.id) return;
      if (notifiedOrderIdsRef.current.has(order.id)) return;

      notifiedOrderIdsRef.current.add(order.id);

      if (typeof window !== "undefined") {
        window.setTimeout(
          () => {
            notifiedOrderIdsRef.current.delete(order.id);
          },
          2 * 60 * 1000,
        );
      }

      const alert: NewOrderAlert = {
        orderId: order.id,
        orderNumber: `#${getOrderNumber(order)}`,
        customerName: getCustomerName(order),
        total: order.total,
        createdAt: order.created_at,
      };

      setNewOrderAlert(alert);

      if (typeof window !== "undefined") {
        if (alertTimeoutRef.current) {
          window.clearTimeout(alertTimeoutRef.current);
        }

        alertTimeoutRef.current = window.setTimeout(() => {
          setNewOrderAlert(null);
        }, 9000);
      }

      if (orderAlertsEnabled) {
        void playNewOrderSound();
      }

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification("Novo pedido recebido", {
          body: `${alert.orderNumber} · ${alert.customerName} · ${formatBRL(alert.total)}`,
          tag: `clickfood-order-${order.id}`,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    },
    [orderAlertsEnabled, playNewOrderSound],
  );

  async function fetchOrderItemsMap(orderIds: string[]) {
    if (orderIds.length === 0) return {};

    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);

    if (error) throw error;

    const grouped: Record<string, OrderItem[]> = {};

    for (const rawItem of (data || []) as Record<string, unknown>[]) {
      const item = normalizeOrderItem(rawItem);

      if (!item.order_id) continue;

      if (!grouped[item.order_id]) {
        grouped[item.order_id] = [];
      }

      grouped[item.order_id].push(item);
    }

    return grouped;
  }

  async function loadOrderItems(orderIds: string[]) {
    if (orderIds.length === 0) {
      setOrderItemsByOrderId({});
      return;
    }

    try {
      const grouped = await fetchOrderItemsMap(orderIds);
      setOrderItemsByOrderId(grouped);
    } catch (err) {
      console.warn("Erro inesperado ao carregar itens dos pedidos:", err);
      setOrderItemsByOrderId({});
    }
  }

  async function loadHistoryOrderItems(orderIds: string[]) {
    if (orderIds.length === 0) {
      setHistoryOrderItemsByOrderId({});
      return;
    }

    try {
      const grouped = await fetchOrderItemsMap(orderIds);
      setHistoryOrderItemsByOrderId(grouped);
    } catch (err) {
      console.warn("Erro inesperado ao carregar itens do histórico:", err);
      setHistoryOrderItemsByOrderId({});
    }
  }

  async function loadOrders(showRefresh = false) {
    if (!restaurant?.id) return;

    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const session = await ensureSupabaseSession();

      if (!session) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .in("status", OPEN_ORDER_STATUSES)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const visibleOrders = ((data || []) as OrderRow[]).filter(
        isOrderVisibleOnBoard,
      );

      setOrders(visibleOrders);
      setLastUpdatedAt(new Date());

      void loadOrderItems(visibleOrders.map((order) => order.id));
    } catch (err) {
      console.error("Erro ao buscar pedidos:", err);
      setError(getErrorMessage(err, "Erro ao buscar pedidos."));
      setOrders([]);
      setOrderItemsByOrderId({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadHistoryOrders(showRefresh = false) {
    if (!restaurant?.id) return;

    try {
      if (showRefresh) {
        setHistoryRefreshing(true);
      } else {
        setHistoryLoading(true);
      }

      setError(null);

      const session = await ensureSupabaseSession();

      if (!session) {
        setHistoryLoading(false);
        setHistoryRefreshing(false);
        return;
      }

      let query = supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (historyFilters.dateFrom) {
        query = query.gte(
          "created_at",
          getDateStartIso(historyFilters.dateFrom),
        );
      }

      if (historyFilters.dateTo) {
        query = query.lte("created_at", getDateEndIso(historyFilters.dateTo));
      }

      const { data, error } = await query;

      if (error) throw error;

      const filteredRows = ((data || []) as OrderRow[]).filter((order) => {
        const paymentMethodMatches =
          historyFilters.paymentMethod === "all" ||
          normalizeStatus(order.payment_method) ===
            normalizeStatus(historyFilters.paymentMethod);

        const deliveryPersonMatches =
          historyFilters.deliveryPersonId === "all" ||
          order.delivery_person_id === historyFilters.deliveryPersonId;

        return (
          matchesHistoryStatus(order, historyFilters.status) &&
          matchesHistoryPaymentStatus(order, historyFilters.paymentStatus) &&
          paymentMethodMatches &&
          deliveryPersonMatches
        );
      });

      setHistoryOrders(filteredRows);

      void loadHistoryOrderItems(filteredRows.map((order) => order.id));
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
      setError(getErrorMessage(err, "Erro ao buscar histórico de pedidos."));
      setHistoryOrders([]);
      setHistoryOrderItemsByOrderId({});
    } finally {
      setHistoryLoading(false);
      setHistoryRefreshing(false);
    }
  }

  async function loadDeliveryPeople() {
    if (!restaurant?.id) return;

    try {
      const session = await ensureSupabaseSession();

      if (!session) return;

      const { data, error } = await supabase
        .from("delivery_people")
        .select("id, name, phone, is_active, created_at")
        .eq("restaurant_id", restaurant.id)
        .order("name", { ascending: true });

      if (error) throw error;

      const people = (data || []) as DeliveryPerson[];

      setAllDeliveryPeople(people);
      setDeliveryPeople(people.filter((person) => person.is_active));
    } catch (err) {
      console.error("Erro ao carregar entregadores:", err);
      setError(getErrorMessage(err, "Erro ao carregar entregadores."));
    }
  }

  async function loadRestaurantSettings() {
    if (!restaurant?.id) return;

    try {
      const session = await ensureSupabaseSession();

      if (!session) return;

      const { data, error } = await supabase
        .from("restaurants")
        .select(
          "name, logo_url, phone, address, average_prep_time_minutes, auto_accept_orders",
        )
        .eq("id", restaurant.id)
        .single();

      if (error) throw error;

      setAveragePrepTimeMinutes(Number(data.average_prep_time_minutes || 30));
      setAutoAcceptOrders(Boolean(data.auto_accept_orders));

      setRestaurantPrintData({
        name: data.name?.trim() || "Restaurante",
        logoUrl: data.logo_url || null,
        phone: data.phone || null,
        address: data.address || null,
      });
    } catch (err) {
      console.error("Erro ao carregar configurações do restaurante:", err);
      setError(
        getErrorMessage(err, "Erro ao carregar configurações do restaurante."),
      );
    }
  }

  async function updateAveragePrepTime(nextValue: number) {
    if (!restaurant?.id) return;

    const previousValue = averagePrepTimeMinutes;

    try {
      setSavingPrepTime(true);
      setAveragePrepTimeMinutes(nextValue);

      const { error } = await supabase
        .from("restaurants")
        .update({ average_prep_time_minutes: nextValue })
        .eq("id", restaurant.id);

      if (error) throw error;
    } catch (err) {
      console.error("Erro ao salvar tempo médio:", err);
      setAveragePrepTimeMinutes(previousValue);
      setError(getErrorMessage(err, "Erro ao salvar tempo médio."));
    } finally {
      setSavingPrepTime(false);
    }
  }

  async function createDesktopPrintJob(orderId: string, forceReprint = false) {
    const { data, error } = await supabase.rpc(
      "create_order_print_job_for_order",
      {
        p_order_id: orderId,
        p_force_reprint: forceReprint,
      },
    );

    if (error) throw error;

    const result = data as {
      success?: boolean;
      error?: string;
      jobId?: string;
      status?: string;
      alreadyExists?: boolean;
    } | null;

    if (result?.success === false) {
      throw new Error(result.error || "Erro ao criar job de impressão.");
    }

    return result;
  }

  async function updateAutoAcceptOrders(nextValue: boolean) {
    if (!restaurant?.id) return;

    const previousValue = autoAcceptOrders;

    try {
      setSavingAutoAcceptOrders(true);
      setAutoAcceptOrders(nextValue);
      setError(null);

      const { error } = await supabase
        .from("restaurants")
        .update({ auto_accept_orders: nextValue })
        .eq("id", restaurant.id);

      if (error) throw error;
    } catch (err) {
      console.error("Erro ao salvar aceite automático:", err);
      setAutoAcceptOrders(previousValue);
      setError(getErrorMessage(err, "Erro ao salvar aceite automático."));
    } finally {
      setSavingAutoAcceptOrders(false);
    }
  }

  async function loadInitialData() {
    if (!restaurant?.id) return;

    setError(null);

    await loadOrders();
    void loadDeliveryPeople();
    void loadRestaurantSettings();
  }
    async function refreshAll() {
    if (!restaurant?.id) return;

    setError(null);

    await Promise.all([
      loadOrders(true),
      loadDeliveryPeople(),
      loadRestaurantSettings(),
    ]);
  }

  async function registerLoyaltyOrder(orderId: string) {
    const session = await ensureSupabaseSession();

    if (!session?.access_token) {
      throw new Error(
        "Sessão expirada. Entre novamente para registrar fidelidade.",
      );
    }

    const loyaltyRoute = "/api/loyalty/register-order";
    const response = await fetch(loyaltyRoute, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        order_id: orderId,
      }),
    });

    const responseContentType = response.headers.get("content-type") || "";
    const responseText = await response.text();
    let result: { success?: boolean; error?: string } | null = null;

    if (responseText) {
      if (!responseContentType.toLowerCase().includes("application/json")) {
        throw new Error(
          `A rota ${loyaltyRoute} retornou HTTP ${response.status} em vez de JSON. Verifique se essa API existe no projeto.`,
        );
      }

      try {
        result = JSON.parse(responseText) as {
          success?: boolean;
          error?: string;
        };
      } catch {
        throw new Error(
          `A rota ${loyaltyRoute} retornou um JSON inválido (HTTP ${response.status}).`,
        );
      }
    }

    if (!response.ok || result?.success === false) {
      throw new Error(
        result?.error ||
          `Erro ao registrar fidelidade (HTTP ${response.status}).`,
      );
    }

    return result;
  }

  async function deductStockForOrder(orderId: string) {
    if (!restaurant?.id) {
      throw new Error("Restaurante não encontrado para baixar estoque.");
    }

    const deductedAt = new Date().toISOString();

    const { data: claimedItems, error: claimError } = await supabase
      .from("order_items")
      .update({ stock_deducted_at: deductedAt })
      .eq("order_id", orderId)
      .is("stock_deducted_at", null)
      .not("product_id", "is", null)
      .select("id, product_id, quantity");

    if (claimError) throw claimError;

    const orderItemsToDeduct = (
      (claimedItems || []) as OrderItemStockDeductionRow[]
    ).filter((item) => item.product_id && Number(item.quantity || 0) > 0);

    if (orderItemsToDeduct.length === 0) return;

    const quantityByProductId = new Map<string, number>();

    for (const item of orderItemsToDeduct) {
      if (!item.product_id) continue;

      const productId = String(item.product_id);
      const quantity = Number(item.quantity || 0);

      quantityByProductId.set(
        productId,
        (quantityByProductId.get(productId) || 0) + quantity,
      );
    }

    const productIds = Array.from(quantityByProductId.keys());

    if (productIds.length === 0) return;

    const { data: recipeRows, error: recipeError } = await supabase
      .from("product_recipe_items")
      .select("product_id, stock_item_id, quantity")
      .eq("restaurant_id", restaurant.id)
      .in("product_id", productIds);

    if (recipeError) throw recipeError;

    const deductionByStockItemId = new Map<string, number>();

    for (const recipe of (recipeRows || []) as ProductRecipeStockRow[]) {
      if (!recipe.product_id || !recipe.stock_item_id) continue;

      const soldQuantity =
        quantityByProductId.get(String(recipe.product_id)) || 0;
      const recipeQuantity = Number(recipe.quantity || 0);
      const totalDeduction = soldQuantity * recipeQuantity;

      if (totalDeduction <= 0) continue;

      const stockItemId = String(recipe.stock_item_id);

      deductionByStockItemId.set(
        stockItemId,
        (deductionByStockItemId.get(stockItemId) || 0) + totalDeduction,
      );
    }

    const stockItemIds = Array.from(deductionByStockItemId.keys());

    if (stockItemIds.length === 0) return;

    const { data: stockRows, error: stockError } = await supabase
      .from("stock_items")
      .select("id, current_quantity")
      .eq("restaurant_id", restaurant.id)
      .in("id", stockItemIds);

    if (stockError) throw stockError;

    for (const stockItem of (stockRows || []) as StockQuantityRow[]) {
      const deductionQuantity = deductionByStockItemId.get(stockItem.id) || 0;

      if (deductionQuantity <= 0) continue;

      const currentQuantity = Number(stockItem.current_quantity || 0);
      const nextQuantity = currentQuantity - deductionQuantity;

      const { error: updateStockError } = await supabase
        .from("stock_items")
        .update({
          current_quantity: nextQuantity,
        })
        .eq("id", stockItem.id)
        .eq("restaurant_id", restaurant.id);

      if (updateStockError) throw updateStockError;
    }
  }

  async function notifyAiOrderStatus(orderId: string, status: string) {
    try {
      if (!restaurant?.id) return;

      await fetch("/api/orders/ai-status-notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          orderId,
          status,
        }),
      });
    } catch (error) {
      console.error(
        "Erro ao notificar cliente sobre status do pedido IA:",
        error,
      );
    }
  }

  async function updateOrder(
    order: OrderRow,
    action: "accept" | "cancel" | "ready" | "route" | "finish",
    deliveryPersonId = "",
  ) {
    const previousOrders = orders;
    const nowIso = new Date().toISOString();

    try {
      setBusyOrderId(order.id);
      setError(null);

      const session = await ensureSupabaseSession();

      if (!session) {
        throw new Error(
          "Sessão expirada. Entre novamente para atualizar o pedido.",
        );
      }

      let payload: Partial<OrderRow> = {};

      if (action === "accept") {
        const acceptingManualPix = isPixAwaitingReview(order);

        payload = {
          status: "accepted",
          accepted_at: nowIso,
          preparation_started_at: nowIso,
          ...(acceptingManualPix
            ? {
                payment_status: "paid",
                pix_confirmed_at: nowIso,
                pix_confirmed_by: user?.id ?? null,
              }
            : {}),
        };
      }

      if (action === "cancel") {
        payload = {
          status: "cancelled",
          payment_status: "cancelled",
          cancelled_at: nowIso,
        };
      }

      if (action === "ready") {
        payload = {
          status: "ready",
        };
      }

      if (action === "route") {
        payload = {
          status: "delivered",
          payment_status: "paid",
          delivery_person_id: deliveryPersonId || null,
          out_for_delivery_at: order.out_for_delivery_at || nowIso,
          delivered_at: nowIso,
        };
      }

      if (action === "finish") {
        payload = {
          status: "delivered",
          payment_status: "paid",
          delivered_at: nowIso,
        };
      }

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                ...payload,
              }
            : item,
        ),
      );

      const { error } = await supabase
        .from("orders")
        .update(payload)
        .eq("id", order.id)
        .eq("restaurant_id", restaurant?.id);

      if (error) throw error;

      if (typeof payload.status === "string" && payload.status.trim()) {
        await notifyAiOrderStatus(order.id, payload.status);
      }

      if (action === "accept") {
        try {
          await deductStockForOrder(order.id);
        } catch (stockError) {
          console.error(
            "Pedido aceito, mas estoque não foi baixado:",
            stockError,
          );

          setError(
            getErrorMessage(
              stockError,
              "Pedido aceito, mas não foi possível baixar o estoque automaticamente.",
            ),
          );
        }

        try {
          await createDesktopPrintJob(order.id);
        } catch (printJobError) {
          console.error(
            "Pedido aceito, mas impressão desktop não foi gerada:",
            printJobError,
          );

          setError(
            getErrorMessage(
              printJobError,
              "Pedido aceito, mas não foi possível enviar para a fila de impressão desktop.",
            ),
          );
        }
      }

      if (payload.status === "delivered") {
        try {
          await registerLoyaltyOrder(order.id);
        } catch (loyaltyError) {
          console.error(
            "Pedido finalizado, mas fidelidade não registrada:",
            loyaltyError,
          );

          setError(
            getErrorMessage(
              loyaltyError,
              "Pedido finalizado, mas não foi possível registrar a fidelidade.",
            ),
          );
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar pedido:", err);
      setOrders(previousOrders);
      setError(getErrorMessage(err, "Erro ao atualizar pedido."));
    } finally {
      setBusyOrderId(null);
    }
  }

  function handlePrintOrder(
    order: OrderRow,
    items: OrderItem[],
    mode: ThermalPrintMode,
  ) {
    printThermalOrder({
      restaurant: restaurantPrintData || getRestaurantPrintData(restaurant),
      mode,
      size: "80mm",
      order: buildThermalOrderPayload(order, items),
    });
  }

  function clearSelectedOrders() {
    setSelectedOrderIds([]);
  }

  function selectVisibleOrders(orderIds: string[]) {
    setSelectedOrderIds(orderIds);
  }

  function handlePrintSelectedOrders(mode: ThermalPrintMode) {
    const selectedOrdersToPrint = orders.filter((order) =>
      selectedOrderIds.includes(order.id),
    );

    if (selectedOrdersToPrint.length === 0) {
      setError("Selecione pelo menos um pedido para imprimir.");
      return;
    }

    const printableOrders =
      mode === "kitchen"
        ? selectedOrdersToPrint.filter((order) => !isPixWaitingOrder(order))
        : selectedOrdersToPrint;

    if (printableOrders.length === 0) {
      setError("Confirme o Pix antes de enviar pedido para a cozinha.");
      return;
    }

    if (
      mode === "kitchen" &&
      printableOrders.length < selectedOrdersToPrint.length
    ) {
      setError("Pedidos em Aguardando Pix não foram enviados para a cozinha.");
    }

    printThermalOrdersBatch({
      restaurant: restaurantPrintData || getRestaurantPrintData(restaurant),
      mode,
      size: "80mm",
      orders: printableOrders.map((order) =>
        buildThermalOrderPayload(order, orderItemsByOrderId[order.id] || []),
      ),
    });
  }

  function updateHistoryFilter(partial: Partial<HistoryFilters>) {
    setHistoryFilters((current) => ({
      ...current,
      ...partial,
    }));
  }

  function setHistoryToday() {
    const today = getTodayInputDate();

    setHistoryFilters((current) => ({
      ...current,
      dateFrom: today,
      dateTo: today,
    }));
  }

  function setHistoryYesterday() {
    const yesterday = getYesterdayInputDate();

    setHistoryFilters((current) => ({
      ...current,
      dateFrom: yesterday,
      dateTo: yesterday,
    }));
  }

  function setHistoryLastSevenDays() {
    setHistoryFilters((current) => ({
      ...current,
      dateFrom: getLastSevenDaysInputDate(),
      dateTo: getTodayInputDate(),
    }));
  }

  function clearHistoryFilters() {
    setHistoryFilters(DEFAULT_HISTORY_FILTERS);
    setHistorySearch("");
  }

  useEffect(() => {
    setSelectedOrderIds((current) =>
      current.filter((orderId) => orders.some((order) => order.id === orderId)),
    );
  }, [orders]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setOrderAlertsEnabled(
      window.localStorage.getItem("clickfood_order_alerts_enabled") === "true",
    );

    setKdsEnabled(
      window.localStorage.getItem("clickfood_kds_enabled") !== "false",
    );

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }

    return () => {
      if (alertTimeoutRef.current) {
        window.clearTimeout(alertTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!restaurant?.id) {
      previousVisibleOrderIdsRef.current = new Set();
      notifiedOrderIdsRef.current = new Set();
      hasSeededVisibleOrdersRef.current = false;
      return;
    }

    const visibleOrders = orders.filter(isOrderVisibleOnBoard);
    const nextIds = new Set(visibleOrders.map((order) => order.id));

    if (!hasSeededVisibleOrdersRef.current) {
      previousVisibleOrderIdsRef.current = nextIds;
      hasSeededVisibleOrdersRef.current = true;
      return;
    }

    const newestIncomingOrder = visibleOrders
      .filter((order) => !previousVisibleOrderIdsRef.current.has(order.id))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];

    previousVisibleOrderIdsRef.current = nextIds;

    if (newestIncomingOrder) {
      showNewOrderAlert(newestIncomingOrder);
    }
  }, [orders, restaurant?.id, showNewOrderAlert]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user || !restaurant?.id) {
      setOrders([]);
      setOrderItemsByOrderId({});
      setHistoryOrders([]);
      setHistoryOrderItemsByOrderId({});
      setDeliveryPeople([]);
      setAllDeliveryPeople([]);
      setNewOrderAlert(null);
      previousVisibleOrderIdsRef.current = new Set();
      notifiedOrderIdsRef.current = new Set();
      hasSeededVisibleOrdersRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setHistoryLoading(false);
      setHistoryRefreshing(false);
      setError(null);
      return;
    }

    void loadInitialData();

    const refreshInterval = window.setInterval(() => {
      void loadOrders(true);
    }, 15000);

    const ordersChannel = supabase
      .channel(`orders-live-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadOrders(true);

          if (activeView === "history") {
            void loadHistoryOrders(true);
          }
        },
      )
      .subscribe();

    const deliveryPeopleChannel = supabase
      .channel(`delivery-people-live-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_people",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadDeliveryPeople();
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(refreshInterval);
      void supabase.removeChannel(ordersChannel);
      void supabase.removeChannel(deliveryPeopleChannel);
    };
  }, [authLoading, restaurant?.id, user?.id, activeView]);

  useEffect(() => {
    if (!restaurant?.id || !user?.id) return;

    const handlePageBack = () => {
      if (document.visibilityState === "visible") {
        void loadOrders(true);
        void loadDeliveryPeople();
        void loadRestaurantSettings();

        if (activeView === "history") {
          void loadHistoryOrders(true);
        }
      }
    };

    const handleWindowFocus = () => {
      void loadOrders(true);
      void loadDeliveryPeople();
      void loadRestaurantSettings();

      if (activeView === "history") {
        void loadHistoryOrders(true);
      }
    };

    document.addEventListener("visibilitychange", handlePageBack);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handlePageBack);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [restaurant?.id, user?.id, activeView]);

  useEffect(() => {
    if (authLoading || activeView !== "history" || !user || !restaurant?.id)
      return;

    void loadHistoryOrders();
  }, [
    activeView,
    authLoading,
    user?.id,
    restaurant?.id,
    historyFilters.dateFrom,
    historyFilters.dateTo,
    historyFilters.status,
    historyFilters.paymentStatus,
    historyFilters.paymentMethod,
    historyFilters.deliveryPersonId,
  ]);
    const openOrders = useMemo(() => {
    return orders.filter(
      (order) =>
        isPixWaitingOrder(order) || getBoardStatus(order.status) !== null,
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return openOrders.filter((order) => {
      if (!normalizedSearch) return true;

      const customerName = getCustomerName(order).toLowerCase();
      const customerPhone = getCustomerPhone(order).toLowerCase();
      const orderNumber = getOrderNumber(order).toLowerCase();

      return (
        customerName.includes(normalizedSearch) ||
        customerPhone.includes(normalizedSearch) ||
        orderNumber.includes(normalizedSearch)
      );
    });
  }, [openOrders, search]);

  const filteredHistoryOrders = useMemo(() => {
    const normalizedSearch = historySearch.trim().toLowerCase();

    return historyOrders.filter((order) => {
      if (!normalizedSearch) return true;

      const items = historyOrderItemsByOrderId[order.id] || [];
      const customerName = getCustomerName(order).toLowerCase();
      const customerPhone = getCustomerPhone(order).toLowerCase();
      const orderNumber = getOrderNumber(order).toLowerCase();
      const address = String(getOrderAddress(order) || "").toLowerCase();
      const neighborhood = String(
        getOrderNeighborhood(order) || "",
      ).toLowerCase();
      const itemNames = items.map((item) => item.name.toLowerCase()).join(" ");

      return (
        customerName.includes(normalizedSearch) ||
        customerPhone.includes(normalizedSearch) ||
        orderNumber.includes(normalizedSearch) ||
        address.includes(normalizedSearch) ||
        neighborhood.includes(normalizedSearch) ||
        itemNames.includes(normalizedSearch)
      );
    });
  }, [historyOrders, historySearch, historyOrderItemsByOrderId]);

  const historyStats = useMemo(() => {
    const totalOrders = filteredHistoryOrders.length;
    const revenue = filteredHistoryOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0,
    );
    const deliveryFees = filteredHistoryOrders.reduce(
      (sum, order) => sum + Number(order.delivery_fee || 0),
      0,
    );
    const finishedOrders = filteredHistoryOrders.filter((order) =>
      isFinishedOrderStatus(order.status),
    ).length;
    const cancelledOrders = filteredHistoryOrders.filter((order) =>
      isCancelledOrderStatus(order.status),
    ).length;

    return {
      totalOrders,
      revenue,
      deliveryFees,
      finishedOrders,
      cancelledOrders,
    };
  }, [filteredHistoryOrders]);

  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set<string>();

    historyOrders.forEach((order) => {
      if (order.payment_method) {
        methods.add(order.payment_method);
      }
    });

    return Array.from(methods).sort((a, b) => a.localeCompare(b));
  }, [historyOrders]);

  const selectedVisibleOrders = useMemo(() => {
    return filteredOrders.filter((order) =>
      selectedOrderIds.includes(order.id),
    );
  }, [filteredOrders, selectedOrderIds]);

  const analysisOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) =>
          isPixWaitingOrder(order) ||
          getBoardStatus(order.status) === "analysis",
      ),
    [filteredOrders],
  );

  const preparationOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) =>
          !isPixWaitingOrder(order) &&
          getBoardStatus(order.status) === "preparation",
      ),
    [filteredOrders],
  );

  const readyOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) =>
          !isPixWaitingOrder(order) && getBoardStatus(order.status) === "ready",
      ),
    [filteredOrders],
  );

  return (
    <AdminLayout
      title="Pedidos"
      description="Central operacional do restaurante"
    >
      <div className="min-h-[calc(100vh-90px)] bg-[#f5f5f5] p-2 sm:p-4">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="flex shrink-0 rounded-xl border border-neutral-900 bg-[#111111] p-1">
                  <button
                    type="button"
                    onClick={() => setActiveView("operation")}
                    className={[
                      "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition",
                      activeView === "operation"
                        ? "bg-white text-[#111111] shadow-sm"
                        : "text-neutral-200 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    <Package className="h-4 w-4" />
                    Operação
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView("history")}
                    className={[
                      "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition",
                      activeView === "history"
                        ? "bg-white text-[#111111] shadow-sm"
                        : "text-neutral-200 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    <History className="h-4 w-4" />
                    Histórico
                  </button>
                </div>

                {activeView === "operation" && (
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar cliente, telefone ou pedido..."
                      className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#111111] focus:ring-2 focus:ring-neutral-200"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 xl:ml-auto xl:justify-end">
                  {activeView === "operation" && (
                    <p className="hidden text-xs font-semibold text-slate-500 2xl:block">
                      {lastUpdatedAt
                        ? `Atualizado ${lastUpdatedAt.toLocaleTimeString(
                            "pt-BR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}`
                        : "Aguardando dados"}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      activeView === "operation"
                        ? void refreshAll()
                        : void loadHistoryOrders(true)
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-black text-[#111111] transition hover:border-neutral-300 hover:bg-neutral-50"
                  >
                    {refreshing || historyRefreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Atualizar</span>
                  </button>

                  {activeView === "operation" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (orderAlertsEnabled) {
                          disableOrderAlerts();
                          return;
                        }

                        void enableOrderAlerts();
                      }}
                      className={[
                        "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition",
                        orderAlertsEnabled
                          ? "border-[#f97316] bg-[#f97316] text-white hover:border-[#ea580c] hover:bg-[#ea580c]"
                          : "border-neutral-200 bg-white text-[#111111] hover:border-neutral-300 hover:bg-neutral-50",
                      ].join(" ")}
                      title={
                        notificationPermission === "denied"
                          ? "O navegador bloqueou notificações de desktop, mas o som do painel pode funcionar."
                          : undefined
                      }
                    >
                      {orderAlertsEnabled ? (
                        <Volume2 className="h-4 w-4" />
                      ) : (
                        <BellRing className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">
                        {orderAlertsEnabled ? "Alertas ativos" : "Alertas"}
                      </span>
                    </button>
                  )}

                  {activeView === "operation" && (
                    <details className="relative z-30">
                      <summary className="inline-flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-black text-[#111111] transition hover:border-neutral-300 hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
                        <Settings2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Ajustes</span>
                      </summary>

                      <div className="absolute right-0 top-12 w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl">
                        <div>
                          <label
                            htmlFor="average-prep-time"
                            className="text-[11px] font-black uppercase tracking-wide text-[#111111]"
                          >
                            Tempo médio de preparo
                          </label>

                          <div className="mt-1.5 flex items-center gap-2">
                            <select
                              id="average-prep-time"
                              value={averagePrepTimeMinutes}
                              onChange={(event) =>
                                updateAveragePrepTime(
                                  Number(event.target.value),
                                )
                              }
                              disabled={savingPrepTime}
                              className="h-10 flex-1 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-[#111111] focus:ring-2 focus:ring-neutral-200"
                            >
                              <option value={10}>10 min</option>
                              <option value={15}>15 min</option>
                              <option value={20}>20 min</option>
                              <option value={25}>25 min</option>
                              <option value={30}>30 min</option>
                              <option value={35}>35 min</option>
                              <option value={40}>40 min</option>
                              <option value={45}>45 min</option>
                              <option value={50}>50 min</option>
                              <option value={60}>60 min</option>
                            </select>

                            {savingPrepTime && (
                              <Loader2 className="h-4 w-4 animate-spin text-[#111111]" />
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={toggleKdsEnabled}
                          className="mt-3 flex w-full items-center justify-between rounded-xl border border-neutral-200 px-3 py-2.5 text-left transition hover:bg-neutral-50"
                        >
                          <div>
                            <p className="text-sm font-black text-slate-900">
                              KDS
                            </p>

                            <p className="text-xs font-semibold text-slate-500">
                              {kdsEnabled
                                ? "A cozinha controla quando fica pronto."
                                : "A tela de pedidos controla o preparo."}
                            </p>
                          </div>

                          <span
                            className={[
                              "rounded-full px-2 py-1 text-[10px] font-black uppercase",
                              kdsEnabled
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-neutral-50 text-[#111111]",
                            ].join(" ")}
                          >
                            {kdsEnabled ? "Ativo" : "Inativo"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void updateAutoAcceptOrders(!autoAcceptOrders)
                          }
                          disabled={savingAutoAcceptOrders}
                          className="mt-2 flex w-full items-center justify-between rounded-xl border border-neutral-200 px-3 py-2.5 text-left transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div>
                            <p className="text-sm font-black text-slate-900">
                              Aceite automático
                            </p>

                            <p className="text-xs font-semibold text-slate-500">
                              Pix manual continua exigindo aceite do atendente.
                            </p>
                          </div>

                          {savingAutoAcceptOrders ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#111111]" />
                          ) : (
                            <span
                              className={[
                                "rounded-full px-2 py-1 text-[10px] font-black uppercase",
                                autoAcceptOrders
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-neutral-50 text-[#111111]",
                              ].join(" ")}
                            >
                              {autoAcceptOrders ? "Ativo" : "Inativo"}
                            </span>
                          )}
                        </button>
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {activeView === "operation" && filteredOrders.length > 0 && (
                <details className="rounded-xl border border-neutral-200 bg-neutral-50/50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 transition hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        Impressão em lote
                      </p>

                      <p className="text-xs font-semibold text-slate-500">
                        {selectedVisibleOrders.length > 0
                          ? `${selectedVisibleOrders.length} selecionado(s)`
                          : `${filteredOrders.length} pedido(s) visível(is)`}
                      </p>
                    </div>

                    <Printer className="h-4 w-4 text-[#111111]" />
                  </summary>

                  <div className="flex flex-wrap gap-2 border-t border-neutral-200 bg-white p-3">
                    <button
                      type="button"
                      onClick={() =>
                        selectVisibleOrders(
                          filteredOrders.map((order) => order.id),
                        )
                      }
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-xs font-black text-[#111111] transition hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      Selecionar todos
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrintSelectedOrders("kitchen")}
                      disabled={selectedVisibleOrders.length === 0}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#111111] px-3 text-xs font-black text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ChefHat className="h-4 w-4" />
                      Cozinha ({selectedVisibleOrders.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrintSelectedOrders("receipt")}
                      disabled={selectedVisibleOrders.length === 0}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-black text-[#f97316] transition hover:border-[#f97316] hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Printer className="h-4 w-4" />
                      Recibos ({selectedVisibleOrders.length})
                    </button>

                    <button
                      type="button"
                      onClick={clearSelectedOrders}
                      disabled={selectedVisibleOrders.length === 0}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Limpar
                    </button>
                  </div>
                </details>
              )}

              {activeView === "history" && (
                <>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_145px_145px_165px_175px_185px]">
                    <div className="relative min-w-0">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />

                      <input
                        value={historySearch}
                        onChange={(event) =>
                          setHistorySearch(event.target.value)
                        }
                        placeholder="Buscar pedido, cliente, bairro ou item..."
                        className="h-10 w-full rounded-xl border border-neutral-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-600 focus:border-[#111111] focus:ring-2 focus:ring-neutral-200"
                      />
                    </div>

                    <input
                      type="date"
                      value={historyFilters.dateFrom}
                      onChange={(event) =>
                        updateHistoryFilter({ dateFrom: event.target.value })
                      }
                      className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#111111] focus:ring-2 focus:ring-neutral-200"
                    />

                    <input
                      type="date"
                      value={historyFilters.dateTo}
                      onChange={(event) =>
                        updateHistoryFilter({ dateTo: event.target.value })
                      }
                      className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#111111] focus:ring-2 focus:ring-neutral-200"
                    />

                    <select
                      value={historyFilters.status}
                      onChange={(event) =>
                        updateHistoryFilter({
                          status: event.target.value as HistoryStatusFilter,
                        })
                      }
                      className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#111111] focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="all">Todos status</option>
                      <option value="open">Em aberto</option>
                      <option value="finished">Finalizados</option>
                      <option value="cancelled">Cancelados</option>
                    </select>

                    <select
                      value={historyFilters.paymentStatus}
                      onChange={(event) =>
                        updateHistoryFilter({
                          paymentStatus: event.target
                            .value as HistoryPaymentStatusFilter,
                        })
                      }
                      className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#111111] focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="all">Todos pagamentos</option>
                      <option value="paid">Pago</option>
                      <option value="pending">Pendente</option>
                      <option value="cancelled">Cancelado/Falhou</option>
                    </select>

                    <select
                      value={historyFilters.deliveryPersonId}
                      onChange={(event) =>
                        updateHistoryFilter({
                          deliveryPersonId: event.target.value,
                        })
                      }
                      className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#111111] focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="all">Todos motoboys</option>

                      {allDeliveryPeople.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={setHistoryToday}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-xs font-black text-[#111111] transition hover:bg-neutral-50"
                    >
                      Hoje
                    </button>

                    <button
                      type="button"
                      onClick={setHistoryYesterday}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-xs font-black text-[#111111] transition hover:bg-neutral-50"
                    >
                      Ontem
                    </button>

                    <button
                      type="button"
                      onClick={setHistoryLastSevenDays}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-xs font-black text-[#111111] transition hover:bg-neutral-50"
                    >
                      7 dias
                    </button>

                    <button
                      type="button"
                      onClick={clearHistoryFilters}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      Limpar
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-[#111111]">
                        Pedidos
                      </p>

                      <p className="mt-1 text-xl font-black text-slate-900">
                        {historyStats.totalOrders}
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-[#111111]">
                        Total vendido
                      </p>

                      <p className="mt-1 text-xl font-black text-slate-900">
                        {formatBRL(historyStats.revenue)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-[#111111]">
                        Taxas de entrega
                      </p>

                      <p className="mt-1 text-xl font-black text-slate-900">
                        {formatBRL(historyStats.deliveryFees)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Finalizados
                      </p>

                      <p className="mt-1 text-xl font-black text-emerald-600">
                        {historyStats.finishedOrders}
                      </p>
                    </div>

                    <div className="rounded-xl border border-red-100 bg-red-50/60 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Cancelados
                      </p>

                      <p className="mt-1 text-xl font-black text-red-600">
                        {historyStats.cancelledOrders}
                      </p>
                    </div>
                  </div>

                  {uniquePaymentMethods.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateHistoryFilter({ paymentMethod: "all" })
                        }
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-black transition",
                          historyFilters.paymentMethod === "all"
                            ? "border-[#111111] bg-[#111111] text-white"
                            : "border-neutral-200 bg-white text-slate-500 hover:bg-neutral-50 hover:text-[#111111]",
                        ].join(" ")}
                      >
                        Todos
                      </button>

                      {uniquePaymentMethods.map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() =>
                            updateHistoryFilter({ paymentMethod: method })
                          }
                          className={[
                            "rounded-full border px-3 py-1.5 text-xs font-black transition",
                            historyFilters.paymentMethod === method
                              ? "border-[#111111] bg-[#111111] text-white"
                              : "border-neutral-200 bg-white text-slate-500 hover:bg-neutral-50 hover:text-[#111111]",
                          ].join(" ")}
                        >
                          {getPaymentLabel(method)}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {activeView === "operation" && newOrderAlert && (
                <div className="overflow-hidden rounded-xl border border-orange-200 bg-orange-50 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f97316] text-white">
                        <BellRing className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">
                          Novo pedido recebido
                        </p>

                        <p className="truncate text-xs font-bold text-orange-700">
                          {newOrderAlert.orderNumber} ·{" "}
                          {newOrderAlert.customerName} ·{" "}
                          {formatBRL(newOrderAlert.total)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setNewOrderAlert(null)}
                      className="shrink-0 rounded-full p-1 text-orange-700 transition hover:bg-orange-100"
                      aria-label="Fechar alerta de novo pedido"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
                    {activeView === "operation" ? (
            loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-neutral-200 bg-white py-20 shadow-sm">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-[#111111]" />
                  Carregando operação...
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="grid min-w-[1020px] grid-cols-3 gap-3">
                  <BoardColumn
                    status="analysis"
                    orders={analysisOrders}
                    orderItemsByOrderId={orderItemsByOrderId}
                    deliveryPeople={deliveryPeople}
                    averagePrepTimeMinutes={averagePrepTimeMinutes}
                    nowMs={nowMs}
                    busyOrderId={busyOrderId}
                    kdsEnabled={kdsEnabled}
                    onAccept={(order) => void updateOrder(order, "accept")}
                    onCancel={(order) => void updateOrder(order, "cancel")}
                    onMarkReady={(order) => void updateOrder(order, "ready")}
                    onSendToRoute={(order, deliveryPersonId) =>
                      void updateOrder(order, "route", deliveryPersonId)
                    }
                    onFinish={(order) => void updateOrder(order, "finish")}
                    onPrint={handlePrintOrder}
                  />

                  <BoardColumn
                    status="preparation"
                    orders={preparationOrders}
                    orderItemsByOrderId={orderItemsByOrderId}
                    deliveryPeople={deliveryPeople}
                    averagePrepTimeMinutes={averagePrepTimeMinutes}
                    nowMs={nowMs}
                    busyOrderId={busyOrderId}
                    kdsEnabled={kdsEnabled}
                    onAccept={(order) => void updateOrder(order, "accept")}
                    onCancel={(order) => void updateOrder(order, "cancel")}
                    onMarkReady={(order) => void updateOrder(order, "ready")}
                    onSendToRoute={(order, deliveryPersonId) =>
                      void updateOrder(order, "route", deliveryPersonId)
                    }
                    onFinish={(order) => void updateOrder(order, "finish")}
                    onPrint={handlePrintOrder}
                  />

                  <BoardColumn
                    status="ready"
                    orders={readyOrders}
                    orderItemsByOrderId={orderItemsByOrderId}
                    deliveryPeople={deliveryPeople}
                    averagePrepTimeMinutes={averagePrepTimeMinutes}
                    nowMs={nowMs}
                    busyOrderId={busyOrderId}
                    kdsEnabled={kdsEnabled}
                    onAccept={(order) => void updateOrder(order, "accept")}
                    onCancel={(order) => void updateOrder(order, "cancel")}
                    onMarkReady={(order) => void updateOrder(order, "ready")}
                    onSendToRoute={(order, deliveryPersonId) =>
                      void updateOrder(order, "route", deliveryPersonId)
                    }
                    onFinish={(order) => void updateOrder(order, "finish")}
                    onPrint={handlePrintOrder}
                  />
                </div>
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              {historyLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-[#111111]" />
                    Carregando histórico...
                  </div>
                </div>
              ) : filteredHistoryOrders.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-center">
                  <div>
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-slate-500">
                      <History className="h-6 w-6" />
                    </div>

                    <p className="text-sm font-black text-slate-900">
                      Nenhum pedido encontrado
                    </p>

                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Ajuste os filtros ou escolha outro período.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-[17%]" />
                      <col className="w-[32%]" />
                      <col className="w-[22%]" />
                      <col className="w-[18%]" />
                      <col className="w-[11%]" />
                    </colgroup>

                    <thead>
                      <tr className="border-b border-neutral-200 bg-white">
                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Pedido / Cliente
                        </th>

                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Entrega
                        </th>

                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Itens
                        </th>

                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Pagamento
                        </th>

                        <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Valor
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredHistoryOrders.map((order) => {
                        const items =
                          historyOrderItemsByOrderId[order.id] || [];
                        const address = getOrderAddress(order);
                        const neighborhood = getOrderNeighborhood(order);
                        const deliveryPersonName = getDeliveryPersonName(
                          allDeliveryPeople,
                          order.delivery_person_id,
                        );

                        return (
                          <tr
                            key={order.id}
                            className="border-b border-neutral-200 last:border-0 transition hover:bg-[#f5f5f5]"
                          >
                            <td className="px-2.5 py-2 align-top">
                              <p className="truncate text-xs font-black text-[#111111]">
                                #{getOrderNumber(order)}
                              </p>

                              <p className="mt-0.5 truncate text-xs font-black text-slate-900">
                                {getCustomerName(order)}
                              </p>

                              <p className="truncate text-[10px] font-semibold text-slate-500">
                                {getCustomerPhone(order)}
                              </p>

                              <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-600">
                                {getOrderTypeLabel(order)}
                              </p>
                            </td>

                            <td className="px-2.5 py-2 align-top">
                              <p className="truncate text-xs font-semibold text-slate-600">
                                {address || "Sem endereço"}
                              </p>

                              <p className="truncate text-[10px] font-black uppercase text-slate-500">
                                {neighborhood || "Bairro não informado"}
                              </p>

                              <p className="truncate text-[10px] font-semibold text-slate-600">
                                Motoboy: {deliveryPersonName || "Não informado"}
                              </p>
                            </td>

                            <td className="px-2.5 py-2 align-top">
                              <p className="truncate text-xs font-semibold text-slate-600">
                                {formatHistoryItemsSummary(items)}
                              </p>

                              <p className="truncate text-[10px] font-semibold text-slate-500">
                                {formatItemCount(items.length)}
                              </p>
                            </td>

                            <td className="px-2.5 py-2 align-top">
                              <span
                                className={[
                                  "inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide",
                                  getOrderStatusBadgeClasses(order.status),
                                ].join(" ")}
                              >
                                {getOrderStatusLabel(order.status)}
                              </span>

                              <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">
                                {getPaymentLabel(order.payment_method)}
                              </p>

                              <p className="truncate text-[10px] font-semibold text-slate-500">
                                {getPaymentStatusLabel(order.payment_status)}
                              </p>

                              <p className="truncate text-[10px] font-semibold text-slate-600">
                                {formatDateTime(order.created_at)}
                              </p>
                            </td>

                            <td className="px-2.5 py-2 text-right align-top">
                              <p className="text-xs font-black text-slate-900">
                                {formatBRL(order.total)}
                              </p>

                              <p className="text-[10px] font-semibold text-slate-500">
                                Taxa {formatBRL(order.delivery_fee)}
                              </p>

                              <button
                                type="button"
                                onClick={() => setSelectedHistoryOrder(order)}
                                className="mt-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-neutral-200 bg-white text-[#111111] transition hover:border-neutral-400 hover:bg-neutral-50"
                                aria-label={`Ver histórico do pedido ${getOrderNumber(order)}`}
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedHistoryOrder && (
        <HistoryOrderDetailsModal
          order={selectedHistoryOrder}
          items={historyOrderItemsByOrderId[selectedHistoryOrder.id] || []}
          deliveryPeople={allDeliveryPeople}
          onClose={() => setSelectedHistoryOrder(null)}
        />
      )}
    </AdminLayout>
  );
}