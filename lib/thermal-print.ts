export type ThermalPrintSize = "58mm" | "80mm"

export type ThermalPrintMode = "kitchen" | "receipt"

export type ThermalPrintRestaurant = {
  name: string
  logoUrl?: string | null
  phone?: string | null
  address?: string | null
}

export type ThermalPrintCustomer = {
  name?: string | null
  phone?: string | null
  cpf?: string | null
  document?: string | null
  address?: string | null
  street?: string | null
  number?: string | number | null
  neighborhood?: string | null
  complement?: string | null
  reference?: string | null
}

export type ThermalPrintItem = {
  name: string
  quantity: number
  price?: number | null
  notes?: string | null
  additions?: string[]
  removals?: string[]
}

export type ThermalPrintOrder = {
  id?: string
  publicOrderNumber?: string | null
  type?: "delivery" | "pickup" | "table" | "counter" | string | null
  tableNumber?: string | number | null
  guestCount?: number | null
  createdAt?: string | Date | null
  customer?: ThermalPrintCustomer | null
  items: ThermalPrintItem[]
  notes?: string | null
  subtotal?: number | null
  deliveryFee?: number | null
  discount?: number | null
  total?: number | null
  paymentMethod?: string | null
  paymentStatus?: string | null
}

type PrintThermalOrderParams = {
  restaurant: ThermalPrintRestaurant
  order: ThermalPrintOrder
  mode?: ThermalPrintMode
  size?: ThermalPrintSize
}

export type PrintThermalOrdersBatchParams = {
  restaurant: ThermalPrintRestaurant
  orders: ThermalPrintOrder[]
  mode?: ThermalPrintMode
  size?: ThermalPrintSize
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function hasText(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined
}

function renderText(value: unknown) {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br />")
}

function formatPrice(value?: number | null) {
  const safeValue = Number(value ?? 0)

  return safeValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function formatDate(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date()

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    })
  }

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function getOrderTypeLabel(type?: string | null) {
  const normalizedType = String(type ?? "").toLowerCase()

  if (normalizedType === "delivery") return "ENTREGA"
  if (normalizedType === "pickup") return "RETIRADA"
  if (normalizedType === "table") return "MESA"
  if (normalizedType === "counter") return "BALCÃO"

  return normalizedType ? normalizedType.toUpperCase() : "PEDIDO"
}

function getPaymentMethodLabel(method?: string | null) {
  const normalizedMethod = String(method ?? "").toLowerCase()

  if (normalizedMethod === "pix") return "Pix automático"
  if (
    normalizedMethod === "pix_manual" ||
    normalizedMethod === "pix_direto" ||
    normalizedMethod === "pix direto" ||
    normalizedMethod === "pix_manual_receipt"
  ) {
    return "Pix direto"
  }
  if (normalizedMethod === "cash" || normalizedMethod === "dinheiro") return "Dinheiro"
  if (normalizedMethod === "card") return "Cartão"
  if (normalizedMethod === "credit_card" || normalizedMethod === "credito") return "Cartão de crédito"
  if (normalizedMethod === "debit_card" || normalizedMethod === "debito") return "Cartão de débito"
  if (normalizedMethod === "card_on_delivery") return "Cartão na entrega"
  if (normalizedMethod === "cash_on_delivery") return "Dinheiro na entrega"
  if (normalizedMethod === "mesa") return "Mesa"

  return method || "Não informado"
}

function getPaymentStatusLabel(status?: string | null) {
  const normalizedStatus = String(status ?? "").toLowerCase()

  if (normalizedStatus === "paid") return "Pago"
  if (normalizedStatus === "awaiting_review") return "Conferir Pix"
  if (normalizedStatus === "waiting_customer_payment") return "Aguardando Pix"
  if (normalizedStatus === "pending") return "Pendente"
  if (normalizedStatus === "failed") return "Falhou"
  if (normalizedStatus === "cancelled") return "Cancelado"

  return status || "Não informado"
}

function getCustomerDocument(customer?: ThermalPrintCustomer | null) {
  return customer?.cpf || customer?.document || null
}
function cleanPrintField(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function normalizeAddressLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

function splitAddressChunks(address: string) {
  return address
    .split(/\s*(?:\r\n|\r|\n|•|\s+-\s+)\s*/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

function buildDeliveryAddressParts(customer?: ThermalPrintCustomer | null) {
  let street = cleanPrintField(customer?.street)
  let number = cleanPrintField(customer?.number)
  let neighborhood = cleanPrintField(customer?.neighborhood)
  let complement = cleanPrintField(customer?.complement)
  let reference = cleanPrintField(customer?.reference)
  let document = cleanPrintField(getCustomerDocument(customer))

  const rawAddress = cleanPrintField(customer?.address)
  const unlabeledChunks: string[] = []

  if (rawAddress) {
    const chunks = splitAddressChunks(rawAddress)

    for (const chunk of chunks) {
      const labeledMatch = chunk.match(/^([^:]+):\s*(.+)$/)

      if (!labeledMatch) {
        unlabeledChunks.push(chunk)
        continue
      }

      const label = normalizeAddressLabel(labeledMatch[1])
      const value = labeledMatch[2].trim()

      if (!value) continue

      if ((label === "rua" || label === "logradouro" || label === "endereco") && !street) {
        street = value
        continue
      }

      if ((label === "numero" || label === "n" || label === "no") && !number) {
        number = value
        continue
      }

      if (label === "bairro" && !neighborhood) {
        neighborhood = value
        continue
      }

      if ((label === "complemento" || label === "compl" || label === "complement") && !complement) {
        complement = value
        continue
      }

      if ((label === "referencia" || label === "ref") && !reference) {
        reference = value
        continue
      }

      if ((label === "cpf" || label === "documento") && !document) {
        document = value
        continue
      }

      unlabeledChunks.push(chunk)
    }

    if (!street && unlabeledChunks[0]) {
      street = unlabeledChunks[0]
    }

    if (!neighborhood && unlabeledChunks[1]) {
      neighborhood = unlabeledChunks[1]
    }

    if (!complement && unlabeledChunks[2]) {
      complement = unlabeledChunks[2]
    }
  }

  if (street && !number) {
    const streetNumberMatch = street.match(/^(.*?),\s*(.+)$/)

    if (streetNumberMatch) {
      street = streetNumberMatch[1].trim()
      number = streetNumberMatch[2].trim()
    }
  }

  return {
    street,
    number,
    neighborhood,
    complement,
    reference,
    document,
  }
}

function buildRestaurantHeader(restaurant: ThermalPrintRestaurant, variant: "kitchen" | "receipt") {
  if (restaurant.logoUrl) {
    return `
      <img
        src="${escapeHtml(restaurant.logoUrl)}"
        alt="${escapeHtml(restaurant.name)}"
        class="restaurant-logo ${variant === "kitchen" ? "kitchen-restaurant-logo" : ""}"
      />
    `
  }

  return `
    <div class="restaurant-name ${variant === "kitchen" ? "kitchen-restaurant-name" : ""}">
      ${escapeHtml(restaurant.name)}
    </div>
  `
}

function buildCustomerSection(order: ThermalPrintOrder, variant: "kitchen" | "receipt") {
  const customer = order.customer
  const document = getCustomerDocument(customer)

  if (!customer?.name && !customer?.phone && !document) return ""

  return `
    <div class="separator"></div>

    <section>
      <div class="section-title">CLIENTE</div>
      ${customer?.name ? `<div class="customer-line">${escapeHtml(customer.name)}</div>` : ""}
      ${customer?.phone ? `<div class="customer-line">${escapeHtml(customer.phone)}</div>` : ""}
      ${document ? `<div class="customer-line ${variant === "receipt" ? "highlight-line" : ""}">CPF: ${escapeHtml(document)}</div>` : ""}
    </section>
  `
}

function buildDeliveryAddressSection(order: ThermalPrintOrder) {
  const customer = order.customer
  const address = buildDeliveryAddressParts(customer)

  if (
    !address.street &&
    !address.number &&
    !address.neighborhood &&
    !address.complement &&
    !address.reference &&
    !address.document
  ) {
    return ""
  }

  return `
    <div class="separator"></div>

    <section class="delivery-box">
      <div class="section-title">ENDEREÇO DE ENTREGA</div>

      ${address.street ? `<div class="address-line"><strong>Rua:</strong> ${escapeHtml(address.street)}</div>` : ""}
      ${address.number ? `<div class="address-line"><strong>Número:</strong> ${escapeHtml(address.number)}</div>` : ""}
      ${address.neighborhood ? `<div class="address-line"><strong>Bairro:</strong> ${escapeHtml(address.neighborhood)}</div>` : ""}
      ${address.complement ? `<div class="address-line"><strong>Complemento:</strong> ${escapeHtml(address.complement)}</div>` : ""}
      ${address.reference ? `<div class="address-line"><strong>Referência:</strong> ${escapeHtml(address.reference)}</div>` : ""}
      ${address.document ? `<div class="address-line"><strong>CPF:</strong> ${escapeHtml(address.document)}</div>` : ""}
    </section>
  `
}

function buildItemsHtml(order: ThermalPrintOrder, mode: ThermalPrintMode) {
  const isKitchen = mode === "kitchen"

  return order.items
    .map((item) => {
      if (isKitchen) {
        return `
          <div class="kitchen-item">
            <div class="kitchen-item-main">
              <span class="kitchen-qty">${escapeHtml(item.quantity)}x</span>
              <strong class="item-name">${renderText(item.name)}</strong>
            </div>

            ${
              item.additions?.length
                ? item.additions
                    .map((addition) => `<div class="item-detail kitchen-detail">+ ${escapeHtml(addition)}</div>`)
                    .join("")
                : ""
            }

            ${
              item.removals?.length
                ? item.removals
                    .map((removal) => `<div class="item-detail kitchen-detail">- ${escapeHtml(removal)}</div>`)
                    .join("")
                : ""
            }

            ${item.notes ? `<div class="item-note kitchen-note">Obs: ${renderText(item.notes)}</div>` : ""}
          </div>
        `
      }

      return `
        <div class="item">
          <div class="item-main">
            <span>${escapeHtml(item.quantity)}x</span>
            <strong class="item-name">${renderText(item.name)}</strong>
          </div>

          ${
            item.additions?.length
              ? item.additions
                  .map((addition) => `<div class="item-detail">+ ${escapeHtml(addition)}</div>`)
                  .join("")
              : ""
          }

          ${
            item.removals?.length
              ? item.removals
                  .map((removal) => `<div class="item-detail">- ${escapeHtml(removal)}</div>`)
                  .join("")
              : ""
          }

          ${item.notes ? `<div class="item-note">Obs: ${renderText(item.notes)}</div>` : ""}

          ${
            typeof item.price === "number"
              ? `
                <div class="row item-price">
                  <span>Valor:</span>
                  <span>${escapeHtml(formatPrice(item.price * item.quantity))}</span>
                </div>
              `
              : ""
          }
        </div>
      `
    })
    .join("")
}

function buildKitchenTicketContent(
  restaurant: ThermalPrintRestaurant,
  order: ThermalPrintOrder
) {
  const orderNumber = order.publicOrderNumber || order.id?.slice(0, 8) || "SEM Nº"
  const typeLabel = getOrderTypeLabel(order.type)
  const isTableOrder = String(order.type ?? "").toLowerCase() === "table"

  return `
    <main class="receipt kitchen-receipt batch-ticket">
      <section class="center">
        ${buildRestaurantHeader(restaurant, "kitchen")}

        <div class="separator strong"></div>

        <div class="kitchen-label">
          ${isTableOrder ? "MESA" : "PEDIDO"}
        </div>

        <div class="order-title kitchen-order-title">
          ${isTableOrder ? escapeHtml(order.tableNumber ?? "-") : `#${escapeHtml(orderNumber)}`}
        </div>

        <div class="muted kitchen-date">
          ${escapeHtml(formatDate(order.createdAt))}
        </div>
      </section>

      <div class="separator"></div>

      <section>
        <div class="row kitchen-row">
          <span>TIPO</span>
          <strong>${escapeHtml(typeLabel)}</strong>
        </div>

        ${
          isTableOrder
            ? `
              <div class="row kitchen-row">
                <span>PESSOAS</span>
                <strong>${escapeHtml(order.guestCount ?? "-")}</strong>
              </div>
            `
            : ""
        }
      </section>

      ${buildCustomerSection(order, "kitchen")}

      <div class="separator"></div>

      <section>
        <div class="section-title kitchen-section-title">ITENS</div>
        ${buildItemsHtml(order, "kitchen")}
      </section>

      ${
        order.notes
          ? `
            <div class="separator"></div>

            <section class="note-box">
              <div class="section-title danger">OBSERVAÇÃO DO PEDIDO</div>
              <div class="big-note">${renderText(order.notes)}</div>
            </section>
          `
          : ""
      }

      <div class="separator strong"></div>

      <section class="center">
        <div class="footer-title">COMANDA DE COZINHA</div>
      </section>
    </main>
  `
}

function buildReceiptTicketContent(
  restaurant: ThermalPrintRestaurant,
  order: ThermalPrintOrder
) {
  const orderNumber = order.publicOrderNumber || order.id?.slice(0, 8) || "SEM Nº"
  const typeLabel = getOrderTypeLabel(order.type)
  const isDeliveryOrder = String(order.type ?? "").toLowerCase() === "delivery"
  const isTableOrder = String(order.type ?? "").toLowerCase() === "table"
  const shouldShowDeliveryAddress = isDeliveryOrder && Boolean(order.customer)

  return `
    <main class="receipt batch-ticket">
      <section class="center">
        ${buildRestaurantHeader(restaurant, "receipt")}
        ${restaurant.phone ? `<div class="muted">${escapeHtml(restaurant.phone)}</div>` : ""}
        ${restaurant.address ? `<div class="muted">${escapeHtml(restaurant.address)}</div>` : ""}

        <div class="separator strong"></div>

        <div class="order-title">
          ${isTableOrder ? `MESA ${escapeHtml(order.tableNumber ?? "-")}` : `PEDIDO #${escapeHtml(orderNumber)}`}
        </div>

        <div class="muted">${escapeHtml(formatDate(order.createdAt))}</div>
      </section>

      <div class="separator"></div>

      <section>
        <div class="row">
          <span>TIPO:</span>
          <strong>${escapeHtml(typeLabel)}</strong>
        </div>

        ${
          isTableOrder
            ? `
              <div class="row">
                <span>PESSOAS:</span>
                <strong>${escapeHtml(order.guestCount ?? "-")}</strong>
              </div>
            `
            : ""
        }
      </section>

      ${buildCustomerSection(order, "receipt")}
      ${shouldShowDeliveryAddress ? buildDeliveryAddressSection(order) : ""}

      <div class="separator"></div>

      <section>
        <div class="section-title">ITENS</div>
        ${buildItemsHtml(order, "receipt")}
      </section>

      <div class="separator"></div>

      <section>
        <div class="section-title">PAGAMENTO</div>

        <div class="row">
          <span>Subtotal:</span>
          <span>${escapeHtml(formatPrice(order.subtotal))}</span>
        </div>

        <div class="row">
          <span>Entrega:</span>
          <span>${escapeHtml(formatPrice(order.deliveryFee))}</span>
        </div>

        <div class="row">
          <span>Desconto:</span>
          <span>${escapeHtml(formatPrice(order.discount))}</span>
        </div>

        <div class="row total-row">
          <span>TOTAL:</span>
          <strong>${escapeHtml(formatPrice(order.total))}</strong>
        </div>

        <div class="row">
          <span>Forma:</span>
          <span>${escapeHtml(getPaymentMethodLabel(order.paymentMethod))}</span>
        </div>

        <div class="row">
          <span>Status:</span>
          <span>${escapeHtml(getPaymentStatusLabel(order.paymentStatus))}</span>
        </div>
      </section>

      ${
        order.notes
          ? `
            <div class="separator"></div>

            <section>
              <div class="section-title">OBSERVAÇÃO</div>
              <div class="line-breaks">${renderText(order.notes)}</div>
            </section>
          `
          : ""
      }

      <div class="separator strong"></div>

      <section class="center">
        <div class="footer-title">OBRIGADO PELA PREFERÊNCIA</div>
        <div class="muted powered">Impresso via ClickFood</div>
      </section>
    </main>
  `
}

function buildKitchenPrintHtml(params: PrintThermalOrderParams) {
  const { restaurant, order, size = "80mm" } = params
  const orderNumber = order.publicOrderNumber || order.id?.slice(0, 8) || "SEM Nº"

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Comanda Pedido ${escapeHtml(orderNumber)}</title>
        ${buildPrintStyles(size)}
      </head>

      <body>
        ${buildKitchenTicketContent(restaurant, order)}
        ${buildPrintScript()}
      </body>
    </html>
  `
}

function buildReceiptPrintHtml(params: PrintThermalOrderParams) {
  const { restaurant, order, size = "80mm" } = params
  const orderNumber = order.publicOrderNumber || order.id?.slice(0, 8) || "SEM Nº"

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Recibo Pedido ${escapeHtml(orderNumber)}</title>
        ${buildPrintStyles(size)}
      </head>

      <body>
        ${buildReceiptTicketContent(restaurant, order)}
        ${buildPrintScript()}
      </body>
    </html>
  `
}

function buildPrintStyles(size: ThermalPrintSize) {
  const width = size === "58mm" ? "58mm" : "80mm"
  const pageHeight = size === "58mm" ? "210mm" : "297mm"
  const receiptPadding = size === "58mm" ? "4px" : "6px"
  const baseFontSize = size === "58mm" ? "10px" : "11px"
  const logoMaxWidth = size === "58mm" ? "34mm" : "44mm"

  return `
    <style>
      @page {
        size: ${width} ${pageHeight};
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #000000;
      }

      html {
        width: 100%;
      }

      body {
        width: 100%;
        min-width: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: ${baseFontSize};
        line-height: 1.2;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .receipt {
        width: ${width};
        max-width: ${width};
        margin: 0 auto;
        padding: ${receiptPadding};
        overflow: visible;
        background: #ffffff;
      }

      .center {
        text-align: center;
      }

      .restaurant-logo {
        display: block;
        width: auto;
        max-width: ${logoMaxWidth};
        max-height: 14mm;
        object-fit: contain;
        margin: 0 auto 3px auto;
        filter: grayscale(1) contrast(1.25);
      }

      .kitchen-restaurant-logo {
        max-height: 13mm;
      }

      .restaurant-name {
        font-size: 15px;
        font-weight: 900;
        line-height: 1.05;
        text-transform: uppercase;
        word-break: break-word;
      }

      .order-title {
        margin-top: 3px;
        font-size: 19px;
        font-weight: 900;
        line-height: 1;
        text-transform: uppercase;
        word-break: break-word;
      }

      .section-title {
        margin-bottom: 3px;
        font-size: 11px;
        font-weight: 900;
        line-height: 1.05;
        text-transform: uppercase;
      }

      .danger {
        font-size: 13px;
      }

      .footer-title {
        font-size: 10px;
        font-weight: 900;
        line-height: 1.1;
        text-transform: uppercase;
      }

      .powered {
        margin-top: 3px;
      }

      .muted {
        font-size: 9px;
        line-height: 1.1;
      }

      .separator {
        width: 100%;
        margin: 5px 0;
        border-top: 1px dashed #000000;
      }

      .separator.strong {
        border-top: 2px solid #000000;
      }

      .row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 6px;
      }

      .row span:last-child,
      .row strong:last-child {
        text-align: right;
      }

      .item {
        padding: 4px 0;
        border-bottom: 1px dashed #000000;
      }

      .item:last-child {
        border-bottom: 0;
      }

      .item-main {
        display: flex;
        align-items: flex-start;
        gap: 4px;
        font-size: 12px;
        line-height: 1.12;
      }

      .item-main span:first-child {
        flex: 0 0 auto;
        font-weight: 900;
      }

      .item-main strong {
        min-width: 0;
        font-weight: 900;
        text-transform: uppercase;
        word-break: break-word;
      }

      .item-name,
      .line-breaks {
        white-space: pre-line;
        word-break: break-word;
      }

      .item-detail {
        padding-left: 16px;
        font-size: 10px;
        line-height: 1.15;
        word-break: break-word;
      }

      .item-note {
        padding-left: 16px;
        margin-top: 2px;
        font-size: 10px;
        font-weight: 800;
        line-height: 1.15;
        word-break: break-word;
        white-space: pre-line;
      }

      .item-price {
        margin-top: 2px;
        font-size: 10px;
      }

      .big-note {
        font-size: 12px;
        font-weight: 900;
        line-height: 1.15;
        text-transform: uppercase;
        word-break: break-word;
        white-space: pre-line;
      }

      .total-row {
        margin: 4px 0;
        padding: 4px 0;
        border-top: 2px solid #000000;
        border-bottom: 2px solid #000000;
        font-size: 14px;
        font-weight: 900;
      }

      .customer-line {
        font-size: 11px;
        font-weight: 700;
        word-break: break-word;
      }

      .highlight-line {
        margin-top: 2px;
        font-size: 12px;
        font-weight: 900;
      }

      .delivery-box {
        border: 2px solid #000000;
        padding: 5px;
      }

      .address-main {
        font-size: 13px;
        font-weight: 900;
        line-height: 1.15;
        text-transform: uppercase;
        word-break: break-word;
      }

      .address-line {
        margin-top: 2px;
        font-size: 11px;
        font-weight: 800;
        line-height: 1.12;
        word-break: break-word;
      }

      .note-box {
        border: 2px solid #000000;
        padding: 5px;
      }

      .kitchen-receipt {
        padding-top: 4px;
      }

      .kitchen-restaurant-name {
        font-size: 14px;
      }

      .kitchen-label {
        margin-top: 2px;
        font-size: 11px;
        font-weight: 900;
        line-height: 1;
        text-transform: uppercase;
      }

      .kitchen-order-title {
        margin-top: 2px;
        font-size: 25px;
        line-height: 0.95;
      }

      .kitchen-date {
        margin-top: 3px;
        font-size: 9px;
      }

      .kitchen-row {
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .kitchen-section-title {
        font-size: 13px;
      }

      .kitchen-item {
        padding: 7px 0;
        border-bottom: 2px solid #000000;
      }

      .kitchen-item:last-child {
        border-bottom: 0;
      }

      .kitchen-item-main {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        font-size: 17px;
        font-weight: 900;
        line-height: 1.05;
        text-transform: uppercase;
      }

      .kitchen-item-main strong {
        min-width: 0;
        word-break: break-word;
      }

      .kitchen-qty {
        flex: 0 0 30px;
        font-weight: 900;
      }

      .kitchen-detail {
        padding-left: 36px;
        margin-top: 3px;
        font-size: 12px;
        font-weight: 800;
      }

      .kitchen-note {
        padding-left: 36px;
        margin-top: 3px;
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .batch-separator {
        width: ${width};
        max-width: ${width};
        height: 12px;
        border-top: 2px dashed #000000;
        margin: 7px auto;
      }

      .batch-separator::after {
        content: "CORTE";
        display: block;
        margin-top: 1px;
        text-align: center;
        font-size: 8px;
        font-weight: 900;
      }

      @media screen {
        body {
          min-height: 100vh;
          background: #f3f4f6;
          padding: 16px 0;
        }

        .receipt {
          min-height: auto;
          box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12), 0 12px 35px rgba(15, 23, 42, 0.18);
        }
      }

      @media print {
        html,
        body {
          width: ${width};
          min-width: ${width};
          max-width: ${width};
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }

        body {
          display: block;
        }

        .receipt {
          width: ${width};
          max-width: ${width};
          margin: 0;
          box-shadow: none;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .batch-ticket {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
    </style>
  `
}

function buildPrintScript() {
  return `
    <script>
      function waitForImages() {
        const images = Array.from(document.images || [])

        if (images.length === 0) {
          return Promise.resolve()
        }

        const imagePromises = images.map((image) => {
          if (image.complete) {
            return Promise.resolve()
          }

          return new Promise((resolve) => {
            image.onload = resolve
            image.onerror = resolve
          })
        })

        const timeoutPromise = new Promise((resolve) => {
          setTimeout(resolve, 900)
        })

        return Promise.race([
          Promise.all(imagePromises),
          timeoutPromise
        ])
      }

      window.addEventListener("load", async () => {
        window.focus()

        await waitForImages()

        setTimeout(() => {
          window.print()
        }, 150)
      })

      window.addEventListener("afterprint", () => {
        setTimeout(() => {
          window.close()
        }, 300)
      })
    </script>
  `
}

function buildBatchPrintHtml(params: PrintThermalOrdersBatchParams) {
  const { restaurant, orders, mode = "kitchen", size = "80mm" } = params

  const ticketsHtml = orders
    .map((order) =>
      mode === "receipt"
        ? buildReceiptTicketContent(restaurant, order)
        : buildKitchenTicketContent(restaurant, order)
    )
    .join(`<div class="batch-separator"></div>`)

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Impressão em lote</title>
        ${buildPrintStyles(size)}
      </head>

      <body>
        ${ticketsHtml}
        ${buildPrintScript()}
      </body>
    </html>
  `
}

export function printThermalOrder(params: PrintThermalOrderParams) {
  if (typeof window === "undefined") return

  const printWindow = window.open("", "_blank", "width=520,height=760")

  if (!printWindow) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.")
    return
  }

  const html =
    params.mode === "receipt"
      ? buildReceiptPrintHtml(params)
      : buildKitchenPrintHtml(params)

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}

export function printThermalOrdersBatch(params: PrintThermalOrdersBatchParams) {
  if (typeof window === "undefined") return

  if (params.orders.length === 0) {
    alert("Selecione pelo menos um pedido para imprimir.")
    return
  }

  const printWindow = window.open("", "_blank", "width=520,height=760")

  if (!printWindow) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.")
    return
  }

  const html = buildBatchPrintHtml(params)

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
