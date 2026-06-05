import http from "k6/http"
import { check } from "k6"

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000"

const RESTAURANT_ID = "5bea1d0c-9991-4ef4-9b7a-70d878d7de65"
const PRODUCT_ID = "fd544abc-f261-4f74-8987-8398828fb039"

export const options = {
  vus: 1,
  iterations: 1,
}

export default function () {
  const payload = JSON.stringify({
    restaurantId: RESTAURANT_ID,
    customerName: `Teste Smoke ${Date.now()}`,
    customerPhone: `319${String(Date.now()).slice(-8)}`,
    customerAddress: "",
    neighborhood: "",
    orderType: "pickup",
    paymentMethod: "dinheiro",
    customerNote: "Pedido automático SMOKE TEST. Pode excluir depois.",
    items: [
      {
        product_id: PRODUCT_ID,
        quantity: 1,
        notes: "Smoke test",
        modifiers: [],
      },
    ],
  })

  const res = http.post(`${BASE_URL}/api/public/orders`, payload, {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: "20s",
  })

  console.log("STATUS:", res.status)
  console.log("CONTENT-TYPE:", res.headers["Content-Type"])
  console.log("BODY:", res.body)

  check(res, {
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
}