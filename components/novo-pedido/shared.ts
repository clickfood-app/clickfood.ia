import type { Product } from "@/lib/products-data";

export const PLACEHOLDER_IMAGE = "/placeholder.svg";

export type DeliveryNeighborhoodOption = {
  id: string;
  ruleId: string;
  label: string;
  neighborhood: string;
  fee: number;
  maxDistanceKm: number | null;
  sortOrder: number;
};

export type ManualModifierOption = {
  id: string;
  name: string;
  price: number;
};

export type ManualModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ManualModifierOption[];
};

export type ProductWithModifiers = Product & {
  categoryName?: string;
  modifierGroups?: ManualModifierGroup[];
  modifier_groups?: ManualModifierGroup[];
};

export type PaymentStatus = "pending" | "paid";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export function getProductGroups(product: ProductWithModifiers | null) {
  if (!product) return [];

  return product.modifierGroups || product.modifier_groups || [];
}

export function getProductImage(product: ProductWithModifiers) {
  const withImage = product as unknown as { image?: string; image_url?: string };

  return (withImage.image || withImage.image_url || PLACEHOLDER_IMAGE) as string;
}

/** Duas primeiras letras do nome: usadas quando o produto não tem foto. */
export function getProductInitials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "•";
}
