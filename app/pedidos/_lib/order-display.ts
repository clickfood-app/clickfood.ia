// Funções puras de apresentação da Central de Pedidos.
// Nada aqui lê ou grava dados: apenas formata o que a página já carregou.

export type BoardStage = "analysis" | "preparation" | "ready";

export type OrderTypeFilter = "all" | "Entrega" | "Retirada" | "Mesa";

export type WaitTone = "new" | "attention" | "warning" | "late";

export type PaymentTone = "paid" | "pending" | "review" | "cancelled";

export type PrimaryActionKind =
  | "accept"
  | "markReady"
  | "pickDeliveryPerson"
  | "finish";

export type PrintMode = "kitchen" | "receipt";

export type DeliveryPersonOption = {
  id: string;
  name: string;
  phone: string | null;
};

export type OrderItemView = {
  id: string;
  quantity: number;
  name: string;
  totalLabel: string | null;
  modifiers: string[];
  notes: string | null;
};

export type OrderTimelineEntry = {
  label: string;
  value: string;
};

export type OrderCardView = {
  id: string;
  number: string;
  typeLabel: string;
  isDelivery: boolean;
  isPixReview: boolean;
  isAiOrder: boolean;
  originLabel: string | null;
  customerName: string;
  customerPhone: string;
  customerCpf: string | null;
  createdAt: string;
  createdAtMs: number;
  createdAtLabel: string;
  preparationDeadlineMs: number;
  address: string | null;
  neighborhood: string | null;
  deliveryFeeLabel: string | null;
  deliveryPersonId: string | null;
  deliveryPersonName: string | null;
  tableNumber: string | null;
  guestCount: number | null;
  paymentLabel: string;
  paymentStatusLabel: string;
  paymentTone: PaymentTone;
  subtotalLabel: string;
  discountLabel: string | null;
  totalLabel: string;
  change: { forLabel: string; amountLabel: string } | null;
  pdvChange: { received: string | null; change: string | null } | null;
  orderNote: string | null;
  pixProofUrl: string | null;
  items: OrderItemView[];
  timeline: OrderTimelineEntry[];
};

export type OrderCardActions = {
  onAccept: (orderId: string) => void;
  onMarkReady: (orderId: string) => void;
  onFinish: (orderId: string) => void;
  onSendToRoute: (orderId: string, deliveryPersonId: string) => void;
  onPrint: (orderId: string, mode: PrintMode) => void;
  onRequestCancel: (orderId: string) => void;
  onOpenDetails: (orderId: string) => void;
};

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

// Janela em que o card recebe o selo NOVO (0–2 min desde a entrada).
export const NEW_ORDER_WINDOW_MS = 2 * MINUTE_MS;

// Progressão visual da espera por aceite. Somente visual: não altera regras.
const ATTENTION_FROM_MS = 2 * MINUTE_MS;
const WARNING_FROM_MS = 5 * MINUTE_MS;
const LATE_FROM_MS = 10 * MINUTE_MS;

export const STAGE_LABELS: Record<BoardStage, string> = {
  analysis: "Novos",
  preparation: "Em preparo",
  ready: "Prontos",
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function toTimestamp(value: string | null | undefined) {
  if (!value) return Number.NaN;

  return new Date(value).getTime();
}

export function getElapsedMs(startMs: number, nowMs: number) {
  if (!Number.isFinite(startMs)) return 0;

  return Math.max(0, nowMs - startMs);
}

export function isRecentlyCreated(createdAtMs: number, nowMs: number) {
  return (
    Number.isFinite(createdAtMs) &&
    nowMs - createdAtMs < NEW_ORDER_WINDOW_MS
  );
}

export function getWaitTone(elapsedMs: number): WaitTone {
  if (!Number.isFinite(elapsedMs) || elapsedMs < ATTENTION_FROM_MS) {
    return "new";
  }

  if (elapsedMs < WARNING_FROM_MS) return "attention";
  if (elapsedMs < LATE_FROM_MS) return "warning";

  return "late";
}

// 0–59 min: "mm:ss" · a partir de 1 h: "1h 05min"
export function formatStopwatch(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / SECOND_MS));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${pad2(minutes)}min`;

  return `${pad2(minutes)}:${pad2(seconds)}`;
}

// "< 1 min" · "12 min" · "1h 05min"
export function formatDurationShort(durationMs: number) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / MINUTE_MS));

  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${pad2(minutes)}min`;
}

export function formatClockTime(value: string | null | undefined) {
  const timestamp = toTimestamp(value);

  if (!Number.isFinite(timestamp)) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatRelativeUpdate(date: Date | null, nowMs: number) {
  if (!date) return "aguardando dados";

  const diffMs = Math.max(0, nowMs - date.getTime());

  if (diffMs < 10 * SECOND_MS) return "atualizado agora";
  if (diffMs < MINUTE_MS) {
    return `atualizado há ${Math.floor(diffMs / SECOND_MS)} s`;
  }
  if (diffMs < 60 * MINUTE_MS) {
    return `atualizado há ${Math.floor(diffMs / MINUTE_MS)} min`;
  }

  return `atualizado às ${new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

// Números longos (ex.: 10 dígitos do cardápio) ganham destaque nos 4 finais,
// sem esconder nenhum dígito do número real.
export function splitOrderNumber(orderNumber: string) {
  if (!/^\d{7,}$/.test(orderNumber)) {
    return { lead: "", tail: orderNumber };
  }

  return {
    lead: orderNumber.slice(0, -4),
    tail: orderNumber.slice(-4),
  };
}

export type TimingTone = WaitTone | "neutral";

export type StageTiming = {
  tone: TimingTone;
  barTone: "yellow" | "orange" | "red" | null;
  isNew: boolean;
  value: string;
  caption: string;
  title: string;
};

// NOVOS: espera desde a entrada (0–2 novo · 2–5 amarelo · 5–10 laranja · >10 vermelho).
// EM PREPARO: mesmo prazo de antes (tempo médio de preparo configurado).
// PRONTOS: tempo total desde a entrada (não existe registro de "ficou pronto").
export function getStageTiming(
  stage: BoardStage,
  createdAtMs: number,
  preparationDeadlineMs: number,
  nowMs: number,
): StageTiming {
  const isNew = isRecentlyCreated(createdAtMs, nowMs);
  const elapsedMs = getElapsedMs(createdAtMs, nowMs);

  if (stage === "analysis") {
    const tone = getWaitTone(elapsedMs);

    return {
      tone,
      barTone:
        tone === "late" ? "red" : tone === "warning" ? "orange" : "yellow",
      isNew: tone === "new",
      value: formatStopwatch(elapsedMs),
      caption: "aguardando",
      title: `Aguardando aceite há ${formatDurationShort(elapsedMs)}`,
    };
  }

  if (stage === "preparation") {
    const remainingMs = preparationDeadlineMs - nowMs;

    if (!Number.isFinite(remainingMs) || remainingMs > 0) {
      const remainingMinutes = Number.isFinite(remainingMs)
        ? Math.ceil(remainingMs / MINUTE_MS)
        : 0;

      return {
        tone: "neutral",
        barTone: isNew ? "yellow" : null,
        isNew,
        value: `${remainingMinutes} min`,
        caption: "restantes",
        title: "Tempo restante pelo tempo médio de preparo",
      };
    }

    return {
      tone: "late",
      barTone: "red",
      isNew,
      value: formatDurationShort(-remainingMs),
      caption: "de atraso",
      title: "Passou do tempo médio de preparo",
    };
  }

  return {
    tone: "neutral",
    barTone: isNew ? "yellow" : null,
    isNew,
    value: formatDurationShort(elapsedMs),
    caption: "no total",
    title: "Tempo total desde a entrada do pedido",
  };
}

export function formatGuestCount(guestCount: number) {
  return `${guestCount} ${guestCount === 1 ? "pessoa" : "pessoas"}`;
}

// Mesma decisão que o card antigo tomava em handlePrimaryAction.
export function getPrimaryActionKind(
  stage: BoardStage,
  isDelivery: boolean,
): PrimaryActionKind {
  if (stage === "analysis") return "accept";
  if (stage === "preparation") return "markReady";
  if (isDelivery) return "pickDeliveryPerson";

  return "finish";
}

export function getPrimaryActionLabel(
  stage: BoardStage,
  view: Pick<OrderCardView, "isPixReview" | "isDelivery" | "typeLabel">,
) {
  if (stage === "analysis") {
    return view.isPixReview ? "Confirmar Pix e aceitar" : "Aceitar";
  }

  if (stage === "preparation") return "Marcar pronto";
  if (view.isDelivery) return "Finalizar entrega";
  if (view.typeLabel === "Mesa") return "Finalizar";

  return "Entregue ao cliente";
}

export type PdvNotesInfo = {
  observation: string | null;
  address: string | null;
  neighborhood: string | null;
  deliveryFee: string | null;
  cashReceived: string | null;
  change: string | null;
  extraLines: string[];
};

const PDV_MODE_LINES = new Set([
  "pedido delivery",
  "pedido balcao",
  "pedido balcão",
]);

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function getValueAfterColon(line: string) {
  const index = line.indexOf(":");

  if (index < 0) return "";

  return line.slice(index + 1).trim();
}

function splitKeyValue(segment: string): [string, string] | null {
  const index = segment.indexOf(":");

  if (index <= 0) return null;

  const key = normalizeKey(segment.slice(0, index));
  const value = segment.slice(index + 1).trim();

  if (!key || !value) return null;

  return [key, value];
}

// Lê o texto que o PDV grava em orders.notes, ex.:
//   Pedido delivery
//   Obs: sem cebola
//   Endereço: Rua X, 123 - Apto 4 - Centro, Cidade
//   Taxa de entrega | Bairro: Centro | Regra: Centro | Valor: R$ 6,00
//   Pagamento: pendente | Forma: Dinheiro | Valor informado: R$ 100,00 | Troco: R$ 23,50
// Totalmente defensiva: se não reconhecer o formato, retorna null e a tela
// mostra o texto original. Nunca altera o pedido.
export function parsePdvNotes(
  notes: string | null | undefined,
): PdvNotesInfo | null {
  if (typeof notes !== "string" || !notes.trim()) return null;

  try {
    const info: PdvNotesInfo = {
      observation: null,
      address: null,
      neighborhood: null,
      deliveryFee: null,
      cashReceived: null,
      change: null,
      extraLines: [],
    };

    const observationLines: string[] = [];
    let readingObservation = false;
    let recognizedLines = 0;

    for (const rawLine of notes.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line) continue;

      const key = normalizeKey(line);

      if (PDV_MODE_LINES.has(key)) {
        recognizedLines += 1;
        readingObservation = false;
        continue;
      }

      if (key.startsWith("obs:")) {
        const value = getValueAfterColon(line);

        if (value) observationLines.push(value);

        recognizedLines += 1;
        readingObservation = true;
        continue;
      }

      if (key.startsWith("endereco:")) {
        info.address = getValueAfterColon(line) || null;
        recognizedLines += 1;
        readingObservation = false;
        continue;
      }

      if (key.startsWith("taxa de entrega")) {
        for (const segment of line.split("|").slice(1)) {
          const pair = splitKeyValue(segment);

          if (!pair) continue;

          if (pair[0] === "bairro") info.neighborhood = pair[1];
          if (pair[0] === "valor") info.deliveryFee = pair[1];
        }

        recognizedLines += 1;
        readingObservation = false;
        continue;
      }

      if (key.startsWith("pagamento:")) {
        for (const segment of line.split("|")) {
          const pair = splitKeyValue(segment);

          if (!pair) continue;

          if (pair[0] === "valor informado") info.cashReceived = pair[1];
          if (pair[0] === "troco") info.change = pair[1];
        }

        recognizedLines += 1;
        readingObservation = false;
        continue;
      }

      if (readingObservation) {
        observationLines.push(line);
        continue;
      }

      info.extraLines.push(line);
    }

    if (recognizedLines === 0) return null;

    info.observation =
      observationLines.length > 0 ? observationLines.join("\n") : null;

    return info;
  } catch {
    return null;
  }
}
