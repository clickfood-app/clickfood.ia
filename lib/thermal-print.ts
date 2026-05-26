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
  address?: string | null
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
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

  if (normalizedMethod === "pix") return "Pix"
  if (normalizedMethod === "cash") return "Dinheiro"
  if (normalizedMethod === "card") return "Cartão"
  if (normalizedMethod === "credit_card") return "Cartão de crédito"
  if (normalizedMethod === "debit_card") return "Cartão de débito"
  if (normalizedMethod === "card_on_delivery") return "Cartão na entrega"
  if (normalizedMethod === "cash_on_delivery") return "Dinheiro na entrega"

  return method || "Não informado"
}

function getPaymentStatusLabel(status?: string | null) {
  const normalizedStatus = String(status ?? "").toLowerCase()

  if (normalizedStatus === "paid") return "Pago"
  if (normalizedStatus === "pending") return "Pendente"
  if (normalizedStatus === "failed") return "Falhou"
  if (normalizedStatus === "cancelled") return "Cancelado"

  return status || "Não informado"
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

function buildKitchenPrintHtml(params: PrintThermalOrderParams) {
  const { restaurant, order, size = "80mm" } = params
  const orderNumber = order.publicOrderNumber || order.id?.slice(0, 8) || "SEM Nº"
  const typeLabel = getOrderTypeLabel(order.type)
  const isTableOrder = String(order.type ?? "").toLowerCase() === "table"

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Comanda Pedido ${escapeHtml(orderNumber)}</title>
        ${buildPrintStyles(size)}
      </head>

      <body>
        <main class="receipt kitchen-receipt">
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

          ${
            order.customer?.name || order.customer?.phone
              ? `
                <div class="separator"></div>

                <section>
                  <div class="section-title">CLIENTE</div>
                  ${order.customer?.name ? `<div class="customer-line">${escapeHtml(order.customer.name)}</div>` : ""}
                  ${order.customer?.phone ? `<div class="customer-line">${escapeHtml(order.customer.phone)}</div>` : ""}
                </section>
              `
              : ""
          }

          <div class="separator"></div>

          <section>
            <div class="section-title kitchen-section-title">ITENS</div>

            ${order.items
              .map(
                (item) => `
                  <div class="kitchen-item">
                    <div class="kitchen-item-main">
                      <span class="kitchen-qty">${escapeHtml(item.quantity)}x</span>
                      <strong>${escapeHtml(item.name)}</strong>
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

                    ${item.notes ? `<div class="item-note kitchen-note">Obs: ${escapeHtml(item.notes)}</div>` : ""}
                  </div>
                `,
              )
              .join("")}
          </section>

          ${
            order.notes
              ? `
                <div class="separator"></div>

                <section class="note-box">
                  <div class="section-title danger">OBSERVAÇÃO DO PEDIDO</div>
                  <div class="big-note">${escapeHtml(order.notes)}</div>
                </section>
              `
              : ""
          }

          <div class="separator strong"></div>

          <section class="center">
            <div class="footer-title">COMANDA DE COZINHA</div>
          </section>
        </main>

        ${buildPrintScript()}
      </body>
    </html>
  `
}

function buildReceiptPrintHtml(params: PrintThermalOrderParams) {
  const { restaurant, order, size = "80mm" } = params
  const orderNumber = order.publicOrderNumber || order.id?.slice(0, 8) || "SEM Nº"
  const typeLabel = getOrderTypeLabel(order.type)
  const isDeliveryOrder = String(order.type ?? "").toLowerCase() === "delivery"
  const isTableOrder = String(order.type ?? "").toLowerCase() === "table"

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Recibo Pedido ${escapeHtml(orderNumber)}</title>
        ${buildPrintStyles(size)}
      </head>

      <body>
        <main class="receipt">
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

          ${
            order.customer?.name || order.customer?.phone
              ? `
                <div class="separator"></div>

                <section>
                  <div class="section-title">CLIENTE</div>
                  ${order.customer?.name ? `<div>${escapeHtml(order.customer.name)}</div>` : ""}
                  ${order.customer?.phone ? `<div>${escapeHtml(order.customer.phone)}</div>` : ""}
                </section>
              `
              : ""
          }

          ${
            isDeliveryOrder && order.customer?.address
              ? `
                <div class="separator"></div>

                <section>
                  <div class="section-title">ENDEREÇO</div>
                  <div>${escapeHtml(order.customer.address)}</div>
                  ${order.customer.neighborhood ? `<div>${escapeHtml(order.customer.neighborhood)}</div>` : ""}
                  ${order.customer.complement ? `<div>Compl: ${escapeHtml(order.customer.complement)}</div>` : ""}
                  ${order.customer.reference ? `<div>Ref: ${escapeHtml(order.customer.reference)}</div>` : ""}
                </section>
              `
              : ""
          }

          <div class="separator"></div>

          <section>
            <div class="section-title">ITENS</div>

            ${order.items
              .map(
                (item) => `
                  <div class="item">
                    <div class="item-main">
                      <span>${escapeHtml(item.quantity)}x</span>
                      <strong>${escapeHtml(item.name)}</strong>
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

                    ${item.notes ? `<div class="item-note">Obs: ${escapeHtml(item.notes)}</div>` : ""}

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
                `,
              )
              .join("")}
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
                  <div>${escapeHtml(order.notes)}</div>
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

        ${buildPrintScript()}
      </body>
    </html>
  `
}

function buildPrintStyles(size: ThermalPrintSize) {
  const width = size === "58mm" ? "58mm" : "80mm"
  const receiptPadding = size === "58mm" ? "5px" : "7px"
  const baseFontSize = size === "58mm" ? "11px" : "12px"
  const logoMaxWidth = size === "58mm" ? "42mm" : "58mm"

  return `
    <style>
      @page {
        size: ${width} auto;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: ${width};
        min-width: ${width};
        max-width: ${width};
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #000000;
      }

      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: ${baseFontSize};
        line-height: 1.25;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .receipt {
        width: ${width};
        max-width: ${width};
        padding: ${receiptPadding};
        overflow: hidden;
      }

      .center {
        text-align: center;
      }

      .restaurant-logo {
        display: block;
        width: auto;
        max-width: ${logoMaxWidth};
        max-height: 20mm;
        object-fit: contain;
        margin: 0 auto 4px auto;
        filter: grayscale(1) contrast(1.25);
      }

      .kitchen-restaurant-logo {
        max-height: 16mm;
      }

      .restaurant-name {
        font-size: 16px;
        font-weight: 900;
        line-height: 1.1;
        text-transform: uppercase;
        word-break: break-word;
      }

      .order-title {
        margin-top: 4px;
        font-size: 21px;
        font-weight: 900;
        line-height: 1;
        text-transform: uppercase;
        word-break: break-word;
      }

      .section-title {
        margin-bottom: 4px;
        font-size: 12px;
        font-weight: 900;
        line-height: 1.1;
        text-transform: uppercase;
      }

      .danger {
        font-size: 14px;
      }

      .footer-title {
        font-size: 11px;
        font-weight: 900;
        line-height: 1.15;
        text-transform: uppercase;
      }

      .powered {
        margin-top: 4px;
      }

      .muted {
        font-size: 10px;
        line-height: 1.15;
      }

      .separator {
        width: 100%;
        margin: 7px 0;
        border-top: 1px dashed #000000;
      }

      .separator.strong {
        border-top: 2px solid #000000;
      }

      .row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .row span:last-child,
      .row strong:last-child {
        text-align: right;
      }

      .item {
        padding: 5px 0;
        border-bottom: 1px dashed #000000;
      }

      .item:last-child {
        border-bottom: 0;
      }

      .item-main {
        display: flex;
        gap: 5px;
        font-size: 14px;
        line-height: 1.15;
      }

      .item-main strong {
        font-weight: 900;
        text-transform: uppercase;
        word-break: break-word;
      }

      .item-detail {
        padding-left: 18px;
        font-size: 12px;
        line-height: 1.2;
        word-break: break-word;
      }

      .item-note {
        padding-left: 18px;
        margin-top: 3px;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.2;
        word-break: break-word;
      }

      .item-price {
        margin-top: 3px;
        font-size: 11px;
      }

      .big-note {
        font-size: 15px;
        font-weight: 900;
        line-height: 1.2;
        text-transform: uppercase;
        word-break: break-word;
      }

      .total-row {
        margin: 6px 0;
        padding: 5px 0;
        border-top: 2px solid #000000;
        border-bottom: 2px solid #000000;
        font-size: 16px;
        font-weight: 900;
      }

      .customer-line {
        font-size: 12px;
        font-weight: 700;
        word-break: break-word;
      }

      .note-box {
        border: 2px solid #000000;
        padding: 6px;
      }

      .kitchen-receipt {
        padding-top: 5px;
      }

      .kitchen-restaurant-name {
        font-size: 15px;
      }

      .kitchen-label {
        margin-top: 2px;
        font-size: 12px;
        font-weight: 900;
        line-height: 1;
        text-transform: uppercase;
      }

      .kitchen-order-title {
        margin-top: 3px;
        font-size: 28px;
        line-height: 0.95;
      }

      .kitchen-date {
        margin-top: 4px;
        font-size: 10px;
      }

      .kitchen-row {
        font-size: 13px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .kitchen-section-title {
        font-size: 14px;
      }

      .kitchen-item {
        padding: 8px 0;
        border-bottom: 2px solid #000000;
      }

      .kitchen-item:last-child {
        border-bottom: 0;
      }

      .kitchen-item-main {
        display: flex;
        align-items: flex-start;
        gap: 7px;
        font-size: 20px;
        font-weight: 900;
        line-height: 1.05;
        text-transform: uppercase;
      }

      .kitchen-item-main strong {
        word-break: break-word;
      }

      .kitchen-qty {
        min-width: 34px;
        font-weight: 900;
      }

      .kitchen-detail {
        padding-left: 42px;
        margin-top: 3px;
        font-size: 14px;
        font-weight: 800;
      }

      .kitchen-note {
        padding-left: 42px;
        margin-top: 4px;
        font-size: 14px;
        font-weight: 900;
        text-transform: uppercase;
      }

      @media screen {
        body {
          background: #f3f4f6;
        }

        .receipt {
          min-height: 100vh;
          background: #ffffff;
        }
      }

      @media print {
        html,
        body {
          width: ${width};
          min-width: ${width};
          max-width: ${width};
          background: #ffffff;
        }

        .receipt {
          width: ${width};
          max-width: ${width};
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

export function printThermalOrder(params: PrintThermalOrderParams) {
  if (typeof window === "undefined") return

  const printWindow = window.open("", "_blank", "width=420,height=720")

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
export type PrintThermalOrdersBatchParams = {
  restaurant: ThermalPrintRestaurant
  orders: ThermalPrintOrder[]
  mode?: ThermalPrintMode
  size?: ThermalPrintSize
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

      ${
        order.customer?.name || order.customer?.phone
          ? `
            <div class="separator"></div>

            <section>
              <div class="section-title">CLIENTE</div>
              ${order.customer?.name ? `<div class="customer-line">${escapeHtml(order.customer.name)}</div>` : ""}
              ${order.customer?.phone ? `<div class="customer-line">${escapeHtml(order.customer.phone)}</div>` : ""}
            </section>
          `
          : ""
      }

      <div class="separator"></div>

      <section>
        <div class="section-title kitchen-section-title">ITENS</div>

        ${order.items
          .map(
            (item) => `
              <div class="kitchen-item">
                <div class="kitchen-item-main">
                  <span class="kitchen-qty">${escapeHtml(item.quantity)}x</span>
                  <strong>${escapeHtml(item.name)}</strong>
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

                ${item.notes ? `<div class="item-note kitchen-note">Obs: ${escapeHtml(item.notes)}</div>` : ""}
              </div>
            `,
          )
          .join("")}
      </section>

      ${
        order.notes
          ? `
            <div class="separator"></div>

            <section class="note-box">
              <div class="section-title danger">OBSERVAÇÃO DO PEDIDO</div>
              <div class="big-note">${escapeHtml(order.notes)}</div>
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

      ${
        order.customer?.name || order.customer?.phone
          ? `
            <div class="separator"></div>

            <section>
              <div class="section-title">CLIENTE</div>
              ${order.customer?.name ? `<div>${escapeHtml(order.customer.name)}</div>` : ""}
              ${order.customer?.phone ? `<div>${escapeHtml(order.customer.phone)}</div>` : ""}
            </section>
          `
          : ""
      }

      ${
        isDeliveryOrder && order.customer?.address
          ? `
            <div class="separator"></div>

            <section>
              <div class="section-title">ENDEREÇO</div>
              <div>${escapeHtml(order.customer.address)}</div>
              ${order.customer.neighborhood ? `<div>${escapeHtml(order.customer.neighborhood)}</div>` : ""}
              ${order.customer.complement ? `<div>Compl: ${escapeHtml(order.customer.complement)}</div>` : ""}
              ${order.customer.reference ? `<div>Ref: ${escapeHtml(order.customer.reference)}</div>` : ""}
            </section>
          `
          : ""
      }

      <div class="separator"></div>

      <section>
        <div class="section-title">ITENS</div>

        ${order.items
          .map(
            (item) => `
              <div class="item">
                <div class="item-main">
                  <span>${escapeHtml(item.quantity)}x</span>
                  <strong>${escapeHtml(item.name)}</strong>
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

                ${item.notes ? `<div class="item-note">Obs: ${escapeHtml(item.notes)}</div>` : ""}

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
            `,
          )
          .join("")}
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
              <div>${escapeHtml(order.notes)}</div>
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

        <style>
          .batch-separator {
            width: 100%;
            height: 14px;
            border-top: 2px dashed #000000;
            margin: 8px 0;
          }

          .batch-separator::after {
            content: "CORTE";
            display: block;
            margin-top: 2px;
            text-align: center;
            font-size: 9px;
            font-weight: 900;
          }

          @media print {
            .batch-ticket {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        ${ticketsHtml}

        ${buildPrintScript()}
      </body>
    </html>
  `
}

export function printThermalOrdersBatch(params: PrintThermalOrdersBatchParams) {
  if (typeof window === "undefined") return

  if (params.orders.length === 0) {
    alert("Selecione pelo menos um pedido para imprimir.")
    return
  }

  const printWindow = window.open("", "_blank", "width=420,height=720")

  if (!printWindow) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.")
    return
  }

  const html = buildBatchPrintHtml(params)

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}