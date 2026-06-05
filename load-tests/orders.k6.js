import http from "k6/http"
import { check, sleep } from "k6"

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000"

const RESTAURANT_ID = "5bea1d0c-9991-4ef4-9b7a-70d878d7de65"
const PRODUCT_ID = "fd544abc-f261-4f74-8987-8398828fb039"

export const options = {
  scenarios: {
    carga_30: {
      executor: "constant-vus",
      vus: 30,
      duration: "60s",
      gracefulStop: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<6000", "p(99)<10000"],
  },
}

function randomPhone() {
  const unique = `${Date.now()}${__VU}${__ITER}${Math.floor(Math.random() * 100000)}`
  return `319${unique.slice(-8)}`
}

function createOrderPayload() {
  const unique = `${__VU}-${__ITER}-${Date.now()}`

  return {
    restaurantId: RESTAURANT_ID,
    customerName: `Teste Carga ${unique}`,
    customerPhone: randomPhone(),
    customerAddress: "",
    neighborhood: "",
    orderType: "pickup",
    paymentMethod: "dinheiro",
    customerNote: "Pedido automático TESTE DE CARGA. Pode excluir depois.",
    items: [
      {
        product_id: PRODUCT_ID,
        quantity: 1,
        notes: "Teste de carga",
        modifiers: [],
      },
    ],
  }
}

export default function () {
  const res = http.post(
    `${BASE_URL}/api/public/orders`,
    JSON.stringify(createOrderPayload()),
    {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: "20s",
    }
  )

  const ok = check(res, {
    "status 200 ou 201": (r) => r.status === 200 || r.status === 201,
    "retornou JSON": (r) =>
      String(r.headers["Content-Type"] || "").includes("application/json"),
    "success true": (r) => {
      try {
        return r.json("success") === true
      } catch {
        return false
      }
    },
  })

  if (!ok) {
    console.log(
      JSON.stringify({
        status: res.status,
        contentType: res.headers["Content-Type"],
        body: String(res.body || "").slice(0, 800),
      })
    )
  }

  sleep(1)
}