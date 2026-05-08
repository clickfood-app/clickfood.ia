import { asaasRequest } from "@/lib/asaas"

type CreateAsaasCustomerInput = {
  name: string
  cpfCnpj: string
  email?: string
  phone?: string
  mobilePhone?: string
}

type AsaasCustomer = {
  id: string
  name: string
  cpfCnpj: string
  email?: string
  phone?: string
  mobilePhone?: string
}

export async function createAsaasCustomer(
  input: CreateAsaasCustomerInput
): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>("/customers", {
    method: "POST",
    body: {
      name: input.name,
      cpfCnpj: input.cpfCnpj,
      email: input.email,
      phone: input.phone,
      mobilePhone: input.mobilePhone,
    },
  })
}