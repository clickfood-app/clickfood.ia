"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { initialCategories, type Product } from "@/lib/products-data";
import {
  type OrderType,
  type PaymentMethod,
  type OrderItem,
  type OrderItemDraft,
  type CustomerData,
  type DeliveryAddress,
} from "@/lib/order-types";
import {
  ArrowLeft,
  Barcode,
  Check,
  ChevronRight,
  Loader2,
  MapPin,
  Minus,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserRoundPlus,
  X,
} from "lucide-react";

type DeliveryFeeRuleRow = {
  id: string;
  restaurant_id: string;
  label: string | null;
  max_distance_km: number | null;
  fee: number | string | null;
  is_active: boolean | null;
  neighborhoods: string[] | null;
  sort_order: number | null;
};

type ProductsCatalogApiProduct = {
  id: string;
  category?: string | null;
};

type ProductsCatalogApiResponse = {
  ok: boolean;
  categories?: string[];
  products?: ProductsCatalogApiProduct[];
  error?: string;
};

type DeliveryNeighborhoodOption = {
  id: string;
  ruleId: string;
  label: string;
  neighborhood: string;
  fee: number;
  maxDistanceKm: number | null;
  sortOrder: number;
};

type ManualModifierOption = {
  id: string;
  name: string;
  price: number;
};

type ManualModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ManualModifierOption[];
};

type ProductWithModifiers = Product & {
  categoryName?: string;
  modifierGroups?: ManualModifierGroup[];
  modifier_groups?: ManualModifierGroup[];
};

type RawModifierGroupRow = Record<string, unknown>;
type RawModifierOptionRow = Record<string, unknown>;
type RawModifierLinkRow = Record<string, unknown>;

type PaymentStatus = "pending" | "paid";

function getSupabaseErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (typeof error === "object") {
    const err = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      err.message ? `message: ${err.message}` : "",
      err.details ? `details: ${err.details}` : "",
      err.hint ? `hint: ${err.hint}` : "",
      err.code ? `code: ${err.code}` : "",
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(" | ");

    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function getStringField(
  row: Record<string, unknown>,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) return value.trim();

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function getNumberField(
  row: Record<string, unknown>,
  keys: string[],
  fallback = 0,
) {
  for (const key of keys) {
    const value = Number(row[key]);

    if (Number.isFinite(value)) return value;
  }

  return fallback;
}

function getBooleanField(
  row: Record<string, unknown>,
  keys: string[],
  fallback = false,
) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["true", "1", "sim", "yes"].includes(normalized)) return true;

      if (["false", "0", "nao", "não", "no"].includes(normalized)) {
        return false;
      }
    }

    if (typeof value === "number") return value === 1;
  }

  return fallback;
}

function isActiveRow(row: Record<string, unknown>) {
  return (
    row.is_active !== false && row.active !== false && row.isActive !== false
  );
}

function normalizeModifierOption(
  row: RawModifierOptionRow,
): ManualModifierOption | null {
  if (!isActiveRow(row)) return null;

  const id = getStringField(row, ["id", "option_id", "optionId"]);

  const name = getStringField(row, [
    "name",
    "title",
    "label",
    "option_name",
    "optionName",
  ]);

  if (!id || !name) return null;

  return {
    id,
    name,
    price: getNumberField(
      row,
      [
        "price",
        "additional_price",
        "additionalPrice",
        "extra_price",
        "extraPrice",
        "value",
      ],
      0,
    ),
  };
}

function normalizeModifierGroup(
  groupRow: RawModifierGroupRow,
  options: ManualModifierOption[],
): ManualModifierGroup | null {
  if (!isActiveRow(groupRow)) return null;

  const id = getStringField(groupRow, [
    "id",
    "group_id",
    "groupId",
    "modifier_group_id",
    "modifierGroupId",
  ]);

  const name = getStringField(groupRow, [
    "name",
    "title",
    "label",
    "group_name",
    "groupName",
  ]);

  if (!id || !name || options.length === 0) return null;

  const required = getBooleanField(
    groupRow,
    ["required", "is_required", "isRequired"],
    false,
  );

  const minSelect = getNumberField(
    groupRow,
    ["min_select", "minSelect", "min", "minimum"],
    required ? 1 : 0,
  );

  const maxSelectRaw = getNumberField(
    groupRow,
    ["max_select", "maxSelect", "max", "maximum"],
    1,
  );

  return {
    id,
    name,
    required,
    minSelect: Math.max(0, minSelect),
    maxSelect: Math.max(1, maxSelectRaw),
    options,
  };
}

function getOptionGroupId(option: RawModifierOptionRow) {
  return getStringField(option, [
    "group_id",
    "groupId",
    "modifier_group_id",
    "modifierGroupId",
  ]);
}

function getLinkProductId(link: RawModifierLinkRow) {
  return getStringField(link, ["product_id", "productId"]);
}

function getLinkGroupId(link: RawModifierLinkRow) {
  return getStringField(link, [
    "modifier_group_id",
    "modifierGroupId",
    "group_id",
    "groupId",
  ]);
}

function getGroupProductId(group: RawModifierGroupRow) {
  return getStringField(group, ["product_id", "productId"]);
}

function getOrderItemKey(item: OrderItemDraft) {
  const modifiersKey = (item.modifiers || [])
    .map(
      (modifier) =>
        `${modifier.groupId || modifier.groupName}:${
          modifier.optionId || modifier.optionName
        }:${modifier.optionPrice}`,
    )
    .join("|");

  return [
    item.productId,
    item.name,
    Number(item.price || 0).toFixed(2),
    modifiersKey,
    item.observation || "",
  ].join("::");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function getCategoryKey(categoryName: string) {
  return `category:${categoryName.trim().toLocaleLowerCase("pt-BR")}`;
}

function getProductGroups(product: ProductWithModifiers | null) {
  if (!product) return [];

  return product.modifierGroups || product.modifier_groups || [];
}

function getProductImage(product: ProductWithModifiers) {
  return (
    ((product as unknown as { image?: string; image_url?: string }).image ||
      (product as unknown as { image?: string; image_url?: string })
        .image_url ||
      "/placeholder.svg") as string
  );
}

function normalizeDeliveryFeeOptions(
  rules: DeliveryFeeRuleRow[],
): DeliveryNeighborhoodOption[] {
  const optionsMap = new Map<string, DeliveryNeighborhoodOption>();

  rules
    .filter((rule) => rule.is_active !== false)
    .forEach((rule, ruleIndex) => {
      const neighborhoods = Array.isArray(rule.neighborhoods)
        ? rule.neighborhoods
        : [];

      neighborhoods.forEach((rawNeighborhood, neighborhoodIndex) => {
        const neighborhood = String(rawNeighborhood || "").trim();

        if (!neighborhood) return;

        const normalizedKey = neighborhood.toLowerCase();
        const fee = Number(rule.fee || 0);
        const sortOrder = Number(rule.sort_order ?? ruleIndex);

        if (optionsMap.has(normalizedKey)) return;

        optionsMap.set(normalizedKey, {
          id: `${rule.id}-${neighborhoodIndex}`,
          ruleId: rule.id,
          label: rule.label || neighborhood,
          neighborhood,
          fee: Number.isFinite(fee) ? fee : 0,
          maxDistanceKm:
            rule.max_distance_km === null ||
            rule.max_distance_km === undefined
              ? null
              : Number(rule.max_distance_km),
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : ruleIndex,
        });
      });
    });

  return Array.from(optionsMap.values()).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;

    return a.neighborhood.localeCompare(b.neighborhood);
  });
}

export default function NovoPedidoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [orderType, setOrderType] = useState<OrderType>(
    "pickup" as OrderType,
  );

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("pix" as PaymentMethod);

  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>("pending");

  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string>("");

  const [products, setProducts] = useState<ProductWithModifiers[]>([]);
  const [categories, setCategories] = useState(initialCategories);

  const [deliveryNeighborhoodOptions, setDeliveryNeighborhoodOptions] =
    useState<DeliveryNeighborhoodOption[]>([]);

  const [selectedDeliveryNeighborhoodId, setSelectedDeliveryNeighborhoodId] =
    useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCustomerPanel, setShowCustomerPanel] = useState(false);
  const [showMobileOrder, setShowMobileOrder] = useState(false);
  const [showPaymentStep, setShowPaymentStep] = useState(false);

  const [customizingProduct, setCustomizingProduct] =
    useState<ProductWithModifiers | null>(null);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [customizingQuantity, setCustomizingQuantity] = useState(1);
  const [customizingObservation, setCustomizingObservation] = useState("");

  const [selectedModifierOptions, setSelectedModifierOptions] = useState<
    Record<string, string[]>
  >({});

  const [receivedAmount, setReceivedAmount] = useState("");

  const [customer, setCustomer] = useState<CustomerData>({
    name: "",
    phone: "",
    observation: "",
  });

  const [address, setAddress] = useState<DeliveryAddress>({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    zipCode: "",
  });

  useEffect(() => {
    const fetchRestaurantProducts = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast({
          title: "Sessão não encontrada",
          description: "Faça login novamente para carregar os produtos.",
          variant: "destructive",
        });

        return;
      }

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single();

      if (restaurantError || !restaurant?.id) {
        toast({
          title: "Restaurante não encontrado",
          description:
            "Não foi possível encontrar o restaurante da conta logada.",
          variant: "destructive",
        });

        return;
      }

      setRestaurantId(restaurant.id);

      const productsCatalogPromise = (async () => {
        try {
          const response = await fetch("/api/products", {
  method: "GET",
  cache: "no-store",
});

const contentType = response.headers.get("content-type") || "";
const responseText = await response.text();

if (!contentType.includes("application/json")) {
  throw new Error(
    `A rota /api/products retornou uma resposta inválida. Status: ${response.status}`,
  );
}

let data: ProductsCatalogApiResponse;

try {
  data = JSON.parse(responseText) as ProductsCatalogApiResponse;
} catch {
  throw new Error(
    "A rota /api/products não retornou um JSON válido.",
  );
}

if (!response.ok || !data.ok) {
  throw new Error(
    data.error ||
      "Não foi possível carregar o catálogo de produtos.",
  );
}

return data;
        } catch (error) {
          console.error(
            "Erro ao sincronizar categorias da aba de produtos:",
            error,
          );

          return {
            ok: false,
            categories: [],
            products: [],
            error:
              error instanceof Error
                ? error.message
                : "Erro ao carregar categorias.",
          } satisfies ProductsCatalogApiResponse;
        }
      })();

      const [
        { data: productsData, error: productsError },
        productsCatalog,
        { data: deliveryFeeRulesData, error: deliveryFeeRulesError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("restaurant_id", restaurant.id),
        productsCatalogPromise,
        supabase
          .from("delivery_fee_rules")
          .select(
            "id, restaurant_id, label, max_distance_km, fee, is_active, neighborhoods, sort_order",
          )
          .eq("restaurant_id", restaurant.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (productsError) {
        console.error("Erro ao buscar produtos:", productsError);

        toast({
          title: "Erro ao carregar produtos",
          description: "Não foi possível buscar os produtos do cardápio.",
          variant: "destructive",
        });
      }

      if (deliveryFeeRulesError) {
        console.error(
          "Erro ao buscar áreas de entrega:",
          deliveryFeeRulesError,
        );

        toast({
          title: "Erro ao carregar bairros",
          description:
            "Não foi possível buscar as áreas de entrega cadastradas.",
          variant: "destructive",
        });
      }

      setDeliveryNeighborhoodOptions(
        normalizeDeliveryFeeOptions(
          ((deliveryFeeRulesData || []) as DeliveryFeeRuleRow[]) || [],
        ),
      );

      const catalogProducts = Array.isArray(productsCatalog.products)
        ? productsCatalog.products
        : [];

      const categoryNameByProductId = new Map(
        catalogProducts
          .map(
            (product) =>
              [
                String(product.id || ""),
                String(product.category || "").trim(),
              ] as const,
          )
          .filter(([productId, categoryName]) => productId && categoryName),
      );

      const catalogCategoryNames = Array.isArray(productsCatalog.categories)
        ? productsCatalog.categories
            .map((categoryName) => String(categoryName || "").trim())
            .filter(Boolean)
        : [];

      const productRows = (
        (productsData || []) as Record<string, unknown>[]
      ).filter((product) => {
        return (
          product.is_active !== false &&
          product.is_available !== false &&
          product.available !== false &&
          product.status !== "inactive" &&
          product.status !== "archived"
        );
      });

      const productIds = productRows
        .map((product) => String(product.id))
        .filter(Boolean);

      const modifierGroupsByProductId = new Map<
        string,
        ManualModifierGroup[]
      >();

      if (productIds.length > 0) {
        const { data: linkRows, error: linkError } = await supabase
          .from("product_modifier_group_links")
          .select("*")
          .in("product_id", productIds);

        if (linkError) {
          console.warn(
            "Complementos vinculados não carregados:",
            linkError.message,
          );
        } else {
          const links = ((linkRows || []) as RawModifierLinkRow[]).filter(
            isActiveRow,
          );

          const groupIds = Array.from(
            new Set(links.map(getLinkGroupId).filter(Boolean)),
          );

          if (groupIds.length > 0) {
            const [
              { data: groupRows, error: groupError },
              { data: optionRows, error: optionError },
            ] = await Promise.all([
              supabase
                .from("modifier_groups")
                .select("*")
                .in("id", groupIds),
              supabase.from("modifier_group_options").select("*"),
            ]);

            if (groupError) {
              console.warn(
                "Grupos de complementos não carregados:",
                groupError.message,
              );
            }

            if (optionError) {
              console.warn(
                "Opções de complementos não carregadas:",
                optionError.message,
              );
            }

            const optionRowsList = (
              (optionRows || []) as RawModifierOptionRow[]
            ).filter(isActiveRow);

            const optionsByGroupId = new Map<
              string,
              ManualModifierOption[]
            >();

            optionRowsList.forEach((optionRow) => {
              const groupId = getOptionGroupId(optionRow);

              if (!groupIds.includes(groupId)) return;

              const option = normalizeModifierOption(optionRow);

              if (!option) return;

              const currentOptions = optionsByGroupId.get(groupId) || [];

              currentOptions.push(option);
              optionsByGroupId.set(groupId, currentOptions);
            });

            const groupsById = new Map<string, ManualModifierGroup>();

            ((groupRows || []) as RawModifierGroupRow[]).forEach(
              (groupRow) => {
                const groupId = getStringField(groupRow, [
                  "id",
                  "group_id",
                  "groupId",
                  "modifier_group_id",
                  "modifierGroupId",
                ]);

                const group = normalizeModifierGroup(
                  groupRow,
                  optionsByGroupId.get(groupId) || [],
                );

                if (group) groupsById.set(group.id, group);
              },
            );

            links
              .sort(
                (a, b) =>
                  getNumberField(a, ["sort_order", "sortOrder"], 0) -
                  getNumberField(b, ["sort_order", "sortOrder"], 0),
              )
              .forEach((link) => {
                const productId = getLinkProductId(link);
                const groupId = getLinkGroupId(link);
                const group = groupsById.get(groupId);

                if (!productId || !group) return;

                const currentGroups =
                  modifierGroupsByProductId.get(productId) || [];

                if (
                  !currentGroups.some(
                    (currentGroup) => currentGroup.id === group.id,
                  )
                ) {
                  currentGroups.push(group);

                  modifierGroupsByProductId.set(
                    productId,
                    currentGroups,
                  );
                }
              });
          }
        }

        const { data: legacyGroupRows, error: legacyGroupError } =
          await supabase
            .from("product_modifier_groups")
            .select("*")
            .in("product_id", productIds);

        if (
          !legacyGroupError &&
          Array.isArray(legacyGroupRows) &&
          legacyGroupRows.length > 0
        ) {
          const legacyGroups = (
            legacyGroupRows as RawModifierGroupRow[]
          ).filter(isActiveRow);

          const legacyGroupIds = legacyGroups
            .map((group) =>
              getStringField(group, [
                "id",
                "group_id",
                "groupId",
                "modifier_group_id",
                "modifierGroupId",
              ]),
            )
            .filter(Boolean);

          const { data: legacyOptionRows, error: legacyOptionError } =
            await supabase
              .from("product_modifier_options")
              .select("*");

          if (legacyOptionError) {
            console.warn(
              "Opções antigas de complementos não carregadas:",
              legacyOptionError.message,
            );
          }

          const legacyOptions = (
            (legacyOptionRows || []) as RawModifierOptionRow[]
          ).filter(isActiveRow);

          const optionsByGroupId = new Map<
            string,
            ManualModifierOption[]
          >();

          legacyOptions.forEach((optionRow) => {
            const groupId = getOptionGroupId(optionRow);

            if (!legacyGroupIds.includes(groupId)) return;

            const option = normalizeModifierOption(optionRow);

            if (!option) return;

            const currentOptions = optionsByGroupId.get(groupId) || [];

            currentOptions.push(option);
            optionsByGroupId.set(groupId, currentOptions);
          });

          legacyGroups
            .sort(
              (a, b) =>
                getNumberField(a, ["sort_order", "sortOrder"], 0) -
                getNumberField(b, ["sort_order", "sortOrder"], 0),
            )
            .forEach((groupRow) => {
              const productId = getGroupProductId(groupRow);

              const groupId = getStringField(groupRow, [
                "id",
                "group_id",
                "groupId",
                "modifier_group_id",
                "modifierGroupId",
              ]);

              const group = normalizeModifierGroup(
                groupRow,
                optionsByGroupId.get(groupId) || [],
              );

              if (!productId || !group) return;

              const currentGroups =
                modifierGroupsByProductId.get(productId) || [];

              if (
                !currentGroups.some(
                  (currentGroup) => currentGroup.id === group.id,
                )
              ) {
                currentGroups.push(group);

                modifierGroupsByProductId.set(
                  productId,
                  currentGroups,
                );
              }
            });
        } else if (legacyGroupError) {
          console.warn(
            "Complementos antigos não carregados:",
            legacyGroupError.message,
          );
        }
      }

      const availableProducts = productRows
        .map((product) => {
          const productId = String(product.id);

          const legacyCategoryName = getStringField(product, [
            "category",
            "category_name",
            "category_title",
          ]);

          const categoryName =
            categoryNameByProductId.get(productId) ||
            legacyCategoryName ||
            "Sem categoria";

          const categoryId = getCategoryKey(categoryName);

          const modifierGroups =
            modifierGroupsByProductId.get(productId) || [];

          return {
            id: productId,
            name: getStringField(
              product,
              ["name"],
              "Produto sem nome",
            ),
            description: getStringField(product, ["description"], ""),
            price: getNumberField(product, ["price"], 0),
            cost: getNumberField(product, ["cost"], 0),
            category: categoryId,
            categoryName,
            image: getStringField(
              product,
              ["image_url", "image"],
              "/placeholder.svg",
            ),
            active: true,
            available: true,
            salesCount: getNumberField(
              product,
              ["sales_count", "salesCount"],
              0,
            ),
            order: getNumberField(
              product,
              ["sort_order", "order"],
              0,
            ),
            modifierGroups,
            modifier_groups: modifierGroups,
          } as ProductWithModifiers;
        })
        .sort(
          (a, b) =>
            Number(a.order || 0) - Number(b.order || 0) ||
            a.name.localeCompare(b.name, "pt-BR"),
        );

      const categoryTemplate = initialCategories[0] || {
        id: "all",
        name: "Todos",
        active: true,
        order: 0,
      };

      const categoryNames = Array.from(
        new Set([
          ...catalogCategoryNames,
          ...availableProducts.map(
            (product) =>
              product.categoryName || "Sem categoria",
          ),
        ]),
      )
        .map((categoryName) => String(categoryName || "").trim())
        .filter(Boolean);

      setProducts(availableProducts);

      setCategories([
        {
          ...categoryTemplate,
          id: "all",
          name: "Todos",
          active: true,
          order: 0,
        },
        ...categoryNames.map((categoryName, index) => ({
          ...categoryTemplate,
          id: getCategoryKey(categoryName),
          name: categoryName,
          active: true,
          order: index + 1,
        })),
      ]);
    };

    fetchRestaurantProducts();
  }, [supabase, toast]);

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const totalItems = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  const selectedDeliveryNeighborhood =
    deliveryNeighborhoodOptions.find(
      (option) => option.id === selectedDeliveryNeighborhoodId,
    );

  const finalDeliveryFee =
    orderType === "delivery"
      ? selectedDeliveryNeighborhood?.fee || 0
      : 0;

  const total = Math.max(
    0,
    subtotal + finalDeliveryFee - discount,
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory = normalizedSearch
        ? true
        : selectedCategory === "all" ||
          product.category === selectedCategory;

      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        String(product.categoryName || product.category || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        String(product.description || "")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [products, searchTerm, selectedCategory]);

  const customizingGroups = getProductGroups(customizingProduct);

  const selectedModifierTotal = useMemo(() => {
    if (!customizingProduct) return 0;

    return customizingGroups.reduce((sum, group) => {
      const selectedIds =
        selectedModifierOptions[group.id] || [];

      const groupTotal = group.options
        .filter((option) => selectedIds.includes(option.id))
        .reduce(
          (optionSum, option) =>
            optionSum + Number(option.price || 0),
          0,
        );

      return sum + groupTotal;
    }, 0);
  }, [
    customizingProduct,
    customizingGroups,
    selectedModifierOptions,
  ]);

  const customProductUnitPrice =
    Number(customizingProduct?.price || 0) +
    selectedModifierTotal;

  const customProductTotal =
    customProductUnitPrice *
    Math.max(1, customizingQuantity);

  const changeAmount = Math.max(
    0,
    Number(receivedAmount || 0) - total,
  );

  const selectedPaymentLabel =
    paymentMethod === "pix"
      ? "Pix"
      : paymentMethod === "dinheiro"
        ? "Dinheiro"
        : paymentMethod === "credito"
          ? "Crédito"
          : paymentMethod === "debito"
            ? "Débito"
            : "Não informado";

  const selectedPaymentStatusLabel =
    paymentStatus === "paid" ? "Já pago" : "Pagamento pendente";

  const changeOrderType = (type: OrderType) => {
    setOrderType(type);
    setShowPaymentStep(false);

    if (type === "delivery") {
      setShowCustomerPanel(true);
    }

    if (type !== "delivery") {
      setSelectedDeliveryNeighborhoodId("");

      setAddress((currentAddress) => ({
        ...currentAddress,
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        zipCode: "",
      }));
    }
  };

  const handleSelectDeliveryNeighborhood = (
    optionId: string,
  ) => {
    const selectedOption =
      deliveryNeighborhoodOptions.find(
        (option) => option.id === optionId,
      );

    setSelectedDeliveryNeighborhoodId(optionId);

    setAddress((currentAddress) => ({
      ...currentAddress,
      neighborhood: selectedOption?.neighborhood || "",
    }));
  };

  const handleAddProduct = useCallback(
    (itemDraft: OrderItemDraft) => {
      setShowPaymentStep(false);

      setItems((prev) => {
        const draft: OrderItemDraft = {
          ...itemDraft,
          quantity: Math.max(
            1,
            Number(itemDraft.quantity || 1),
          ),
          modifiers: itemDraft.modifiers || [],
          observation: itemDraft.observation || "",
        };

        const draftKey = getOrderItemKey(draft);

        const existing = prev.find(
          (item) =>
            getOrderItemKey({
              productId: item.productId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              observation: item.observation || "",
              modifiers: item.modifiers || [],
            }) === draftKey,
        );

        if (existing) {
          return prev.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  quantity:
                    item.quantity +
                    Number(draft.quantity || 1),
                }
              : item,
          );
        }

        return [
          ...prev,
          {
            id: `item-${Date.now()}-${
              draft.productId
            }-${Math.random().toString(36).slice(2)}`,
            productId: draft.productId,
            name: draft.name,
            price: Number(draft.price || 0),
            quantity: Number(draft.quantity || 1),
            observation: draft.observation || "",
            modifiers: draft.modifiers || [],
          },
        ];
      });
    },
    [],
  );

  const resetCustomization = () => {
    setCustomizingProduct(null);
    setEditingItemId(null);
    setSelectedModifierOptions({});
    setCustomizingObservation("");
    setCustomizingQuantity(1);
  };

  const openProductCustomization = (
    product: ProductWithModifiers,
  ) => {
    const groups = getProductGroups(product);

    if (groups.length === 0) {
      handleAddProduct({
        productId: product.id,
        name: product.name,
        price: Number(product.price || 0),
        quantity: 1,
        observation: "",
        modifiers: [],
      });

      return;
    }

    setEditingItemId(null);
    setCustomizingProduct(product);
    setCustomizingQuantity(1);
    setCustomizingObservation("");
    setSelectedModifierOptions({});
  };

  const openItemEditor = (item: OrderItem) => {
    const product = products.find(
      (currentProduct) => currentProduct.id === item.productId,
    );

    if (!product) {
      toast({
        title: "Produto não encontrado",
        description:
          "Não foi possível abrir os complementos deste item.",
        variant: "destructive",
      });

      return;
    }

    const selectedOptions = (item.modifiers || []).reduce<
      Record<string, string[]>
    >((accumulator, modifier) => {
      if (!modifier.groupId || !modifier.optionId) {
        return accumulator;
      }

      accumulator[modifier.groupId] = [
        ...(accumulator[modifier.groupId] || []),
        modifier.optionId,
      ];

      return accumulator;
    }, {});

    setEditingItemId(item.id);
    setCustomizingProduct(product);
    setCustomizingQuantity(Math.max(1, Number(item.quantity || 1)));
    setCustomizingObservation(item.observation || "");
    setSelectedModifierOptions(selectedOptions);
  };

  const toggleModifierOption = (
    group: ManualModifierGroup,
    option: ManualModifierOption,
  ) => {
    setSelectedModifierOptions((prev) => {
      const current = prev[group.id] || [];
      const isSelected = current.includes(option.id);

      if (group.maxSelect <= 1) {
        return {
          ...prev,
          [group.id]: isSelected ? [] : [option.id],
        };
      }

      if (isSelected) {
        return {
          ...prev,
          [group.id]: current.filter(
            (optionId) => optionId !== option.id,
          ),
        };
      }

      if (current.length >= group.maxSelect) {
        return prev;
      }

      return {
        ...prev,
        [group.id]: [...current, option.id],
      };
    });
  };

  const canAddCustomProduct = () => {
    return customizingGroups.every((group) => {
      const selectedIds =
        selectedModifierOptions[group.id] || [];

      return (
        selectedIds.length >= group.minSelect &&
        selectedIds.length <= group.maxSelect
      );
    });
  };

  const confirmCustomProduct = () => {
    if (!customizingProduct) return;

    if (!canAddCustomProduct()) {
      toast({
        title: "Complemento obrigatório",
        description:
          "Selecione os complementos obrigatórios para continuar.",
        variant: "destructive",
      });

      return;
    }

    const modifiers = customizingGroups.flatMap((group) => {
      const selectedIds =
        selectedModifierOptions[group.id] || [];

      return group.options
        .filter((option) =>
          selectedIds.includes(option.id),
        )
        .map((option) => ({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          optionPrice: Number(option.price || 0),
        }));
    });

    if (editingItemId) {
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === editingItemId
            ? {
                ...item,
                productId: customizingProduct.id,
                name: customizingProduct.name,
                price: customProductUnitPrice,
                quantity: Math.max(1, customizingQuantity),
                observation: customizingObservation.trim(),
                modifiers,
              }
            : item,
        ),
      );
      setShowPaymentStep(false);
    } else {
      handleAddProduct({
        productId: customizingProduct.id,
        name: customizingProduct.name,
        price: customProductUnitPrice,
        quantity: customizingQuantity,
        observation: customizingObservation.trim(),
        modifiers,
      });
    }

    resetCustomization();
  };

  const handleUpdateQuantity = useCallback(
    (itemId: string, quantity: number) => {
      if (quantity <= 0) {
        setItems((prev) =>
          prev.filter((item) => item.id !== itemId),
        );

        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, quantity }
            : item,
        ),
      );
    },
    [],
  );

  const handleRemoveItem = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.filter((item) => item.id !== itemId),
    );
  }, []);

  const handleClearOrder = () => {
    setItems([]);
    setDiscount(0);
    setPaymentMethod("pix" as PaymentMethod);
    setPaymentStatus("pending");
    setReceivedAmount("");
    setSelectedDeliveryNeighborhoodId("");
    setShowCustomerPanel(false);
    setShowPaymentStep(false);
    setShowMobileOrder(false);
    resetCustomization();

    setCustomer({
      name: "",
      phone: "",
      observation: "",
    });

    setAddress({
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      zipCode: "",
    });
  };

  const canSubmit = () => {
    if (items.length === 0) return false;

    if (orderType === "delivery") {
      if (
        !address.street ||
        !address.number ||
        !address.neighborhood
      ) {
        return false;
      }

      if (!selectedDeliveryNeighborhood) return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;

    if (!restaurantId) {
      toast({
        title: "Restaurante não encontrado",
        description:
          "Não foi possível identificar o restaurante logado.",
        variant: "destructive",
      });

      return;
    }

    const selectedPaymentMethod = paymentMethod;

    try {
      setIsSubmitting(true);

      const publicOrderNumber = Date.now()
        .toString()
        .slice(-6);

      const addressText =
        orderType === "delivery"
          ? `${address.street}, ${address.number}${
              address.complement
                ? ` - ${address.complement}`
                : ""
            } - ${address.neighborhood}${
              address.city ? `, ${address.city}` : ""
            }`
          : "";

      const orderModeNote =
        orderType === "delivery"
          ? "Pedido delivery"
          : "Pedido balcão";

      const deliveryFeeNote =
        orderType === "delivery" &&
        selectedDeliveryNeighborhood
          ? `Taxa de entrega | Bairro: ${
              selectedDeliveryNeighborhood.neighborhood
            } | Regra: ${
              selectedDeliveryNeighborhood.label
            } | Valor: ${formatCurrency(
              selectedDeliveryNeighborhood.fee,
            )}`
          : "";

      const paymentNote = [
        `Pagamento: ${
          paymentStatus === "paid" ? "pago" : "pendente"
        } | Forma: ${selectedPaymentLabel}`,
        selectedPaymentMethod === "dinheiro" && receivedAmount
          ? `Valor informado: ${formatCurrency(
              Number(receivedAmount || 0),
            )} | Troco: ${formatCurrency(
              Math.max(
                0,
                Number(receivedAmount || 0) - total,
              ),
            )}`
          : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const orderNotes = [
        orderModeNote,
        customer.observation
          ? `Obs: ${customer.observation}`
          : "",
        orderType === "delivery"
          ? `Endereço: ${addressText}`
          : "",
        deliveryFeeNote,
        paymentNote,
      ]
        .filter(Boolean)
        .join("\n");

      const { data: createdOrder, error: orderError } =
        await supabase
          .from("orders")
          .insert({
            restaurant_id: restaurantId,
            public_order_number: publicOrderNumber,
            customer_name:
              customer.name || "Cliente balcão",
            customer_phone:
              customer.phone || "Não informado",
            status: "pending",
            subtotal,
            discount,
            delivery_fee: finalDeliveryFee,
            total,
            payment_method: selectedPaymentMethod,
            payment_status: paymentStatus,
            notes: orderNotes || null,
            table_id: null,
            table_number: null,
            guest_count: null,
          })
          .select("id, public_order_number")
          .single();

      if (orderError) {
        throw orderError;
      }

      const orderItemsPayload = items.map((item) => ({
        order_id: createdOrder.id,
        product_id: item.productId,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        notes: item.observation?.trim() || null,
        modifiers: item.modifiers || [],
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsPayload);

      if (itemsError) {
        await supabase
          .from("orders")
          .delete()
          .eq("id", createdOrder.id);

        throw itemsError;
      }

      let printJobWarning: string | null = null;

      try {
        const {
          data: printJobResult,
          error: printJobError,
        } = await supabase.rpc(
          "create_order_print_job_for_order",
          {
            p_order_id: createdOrder.id,
            p_force_reprint: false,
          },
        );

        if (printJobError) {
          throw printJobError;
        }

        const result = printJobResult as {
          success?: boolean;
          error?: string;
        } | null;

        if (result?.success === false) {
          throw new Error(
            result.error ||
              "Erro ao criar job de impressão.",
          );
        }
      } catch (printJobError) {
        printJobWarning =
          "Pedido criado, mas não foi possível enviar para a fila de impressão desktop.";

        console.error(
          "Pedido manual criado, mas impressão desktop não foi gerada:",
          printJobError,
        );
      }

      toast({
        title: "Pedido criado com sucesso!",
        description: printJobWarning
          ? `Pedido #${createdOrder.public_order_number} foi salvo. ${printJobWarning}`
          : `Pedido #${createdOrder.public_order_number} foi salvo e enviado para impressão.`,
        variant: printJobWarning
          ? "destructive"
          : "default",
      });

      router.push("/pedidos");
    } catch (err) {
      const errorMessage = getSupabaseErrorMessage(
        err,
        "Não foi possível salvar o pedido no sistema.",
      );

      console.error(
        "Erro ao criar pedido manual:",
        errorMessage,
      );

      console.error("Erro bruto:", err);

      toast({
        title: "Erro ao criar pedido",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const orderTypeOptions = [
    {
      value: "pickup" as OrderType,
      label: "Balcão",
      description: "Consumo ou retirada no balcão",
    },
    {
      value: "delivery" as OrderType,
      label: "Entrega",
      description: "Pedido enviado ao endereço do cliente",
    },
  ];

  const paymentStatusOptions: Array<{
    id: PaymentStatus;
    label: string;
    description: string;
  }> = [
    {
      id: "pending",
      label: "Pendente",
      description: "O cliente ainda vai pagar",
    },
    {
      id: "paid",
      label: "Já pago",
      description: "Pagamento já confirmado",
    },
  ];

  const paymentOptions = [
    {
      id: "pix" as PaymentMethod,
      name: "Pix",
    },
    {
      id: "dinheiro" as PaymentMethod,
      name: "Dinheiro",
    },
    {
      id: "credito" as PaymentMethod,
      name: "Crédito",
    },
    {
      id: "debito" as PaymentMethod,
      name: "Débito",
    },
  ];

  const renderOrderPanel = (mobile = false) => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border border-white/[0.08] bg-[#0B0B0B] xl:rounded-xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {showPaymentStep && (
            <button
              type="button"
              onClick={() => setShowPaymentStep(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-[#111111] text-zinc-400 transition hover:border-white/20 hover:text-white"
              aria-label="Voltar para o pedido"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
              {showPaymentStep ? "Fechamento" : "Comanda atual"}
            </p>
            <h2 className="mt-0.5 truncate text-base font-semibold text-white">
              {showPaymentStep ? "Pagamento" : "Pedido atual"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!showPaymentStep && (
            <span className="rounded-md border border-white/[0.08] bg-[#111111] px-2.5 py-1.5 text-xs font-semibold text-zinc-400">
              {totalItems} {totalItems === 1 ? "item" : "itens"}
            </span>
          )}

          {mobile && (
            <button
              type="button"
              onClick={() => setShowMobileOrder(false)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] bg-[#111111] text-zinc-400 transition hover:text-white"
              aria-label="Fechar pedido"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!showPaymentStep ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {items.length === 0 ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 text-center">
                <ShoppingCart className="h-7 w-7 text-zinc-700" />
                <h3 className="mt-4 text-sm font-semibold text-zinc-300">
                  Nenhum item adicionado
                </h3>
                <p className="mt-1 max-w-[240px] text-sm leading-5 text-zinc-600">
                  Toque em um produto do catálogo para iniciar o pedido.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.07]">
                {items.map((item) => (
                  <article key={item.id} className="py-4 first:pt-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold leading-5 text-white">
                          {item.name}
                        </h3>

                        {item.modifiers && item.modifiers.length > 0 && (
                          <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                            {item.modifiers
                              .map((modifier) => modifier.optionName)
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}

                        {item.observation && (
                          <p className="mt-2 border-l-2 border-yellow-400/60 pl-2 text-xs leading-5 text-zinc-400">
                            {item.observation}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-white">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-600">
                          {formatCurrency(item.price)} cada
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex h-9 items-center overflow-hidden rounded-md border border-white/[0.08] bg-[#111111]">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuantity(item.id, item.quantity - 1)
                          }
                          className="flex h-9 w-9 items-center justify-center text-zinc-500 transition hover:bg-white/[0.04] hover:text-white"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>

                        <span className="w-8 text-center text-sm font-semibold text-white">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuantity(item.id, item.quantity + 1)
                          }
                          className="flex h-9 w-9 items-center justify-center text-zinc-500 transition hover:bg-white/[0.04] hover:text-white"
                          aria-label="Aumentar quantidade"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openItemEditor(item)}
                          className="flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-[#111111] px-3 text-xs font-semibold text-zinc-400 transition hover:border-white/20 hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] bg-[#111111] text-zinc-600 transition hover:border-red-500/30 hover:text-red-400"
                          aria-label="Remover item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.08] bg-[#090909] p-4">
            <label className="block text-xs font-semibold text-zinc-400">
              Observação do pedido
            </label>
            <textarea
              value={customer.observation || ""}
              onChange={(event) =>
                setCustomer({
                  ...customer,
                  observation: event.target.value,
                })
              }
              placeholder="Ex.: embalar para viagem, chamar o cliente no balcão..."
              rows={2}
              className="mt-2 w-full resize-none rounded-md border border-white/[0.08] bg-[#111111] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-yellow-400/50"
            />

            <div className="mt-4 space-y-2.5 border-t border-white/[0.07] pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-medium text-zinc-200">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              {orderType === "delivery" && (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-zinc-500">
                    Taxa de entrega
                    {selectedDeliveryNeighborhood
                      ? ` · ${selectedDeliveryNeighborhood.neighborhood}`
                      : ""}
                  </span>
                  <span className="shrink-0 font-medium text-zinc-200">
                    {selectedDeliveryNeighborhood
                      ? formatCurrency(finalDeliveryFee)
                      : "Não definida"}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="order-discount" className="text-zinc-500">
                  Desconto
                </label>
                <div className="flex h-9 w-28 items-center rounded-md border border-white/[0.08] bg-[#111111] px-2.5">
                  <span className="text-xs text-zinc-600">R$</span>
                  <input
                    id="order-discount"
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(event) =>
                      setDiscount(
                        Math.max(0, Number(event.target.value || 0)),
                      )
                    }
                    className="min-w-0 flex-1 bg-transparent text-right text-sm font-medium text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-end justify-between border-t border-white/[0.07] pt-4">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-2xl font-semibold tracking-tight text-yellow-400">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPaymentStep(true)}
              disabled={items.length === 0}
              className={cn(
                "mt-4 flex h-12 w-full items-center justify-center rounded-md text-sm font-semibold transition",
                items.length > 0
                  ? "bg-yellow-400 text-black hover:bg-yellow-300"
                  : "cursor-not-allowed bg-[#151515] text-zinc-700",
              )}
            >
              Continuar para pagamento
            </button>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="border-b border-white/[0.08] pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
              Valor do pedido
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
              {formatCurrency(total)}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {totalItems} {totalItems === 1 ? "item" : "itens"} ·{" "}
              {orderType === "delivery" ? "Entrega" : "Balcão"}
            </p>
          </div>

          <section className="mt-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-white">
                Situação do pagamento
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Informe se o pagamento já foi confirmado.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {paymentStatusOptions.map((statusOption) => {
                const active = paymentStatus === statusOption.id;

                return (
                  <button
                    key={statusOption.id}
                    type="button"
                    onClick={() => setPaymentStatus(statusOption.id)}
                    className={cn(
                      "min-h-[74px] rounded-md border px-3 py-3 text-left transition",
                      active
                        ? "border-yellow-400 bg-yellow-400 text-black"
                        : "border-white/[0.08] bg-[#111111] text-zinc-300 hover:border-white/20",
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {statusOption.label}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-[11px] leading-4",
                        active ? "text-black/60" : "text-zinc-600",
                      )}
                    >
                      {statusOption.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-white">
                Forma de pagamento
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Selecione como o cliente pagou ou vai pagar.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map((method) => {
                const active = paymentMethod === method.id;

                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method.id);

                      if (method.id !== "dinheiro") {
                        setReceivedAmount("");
                      }
                    }}
                    className={cn(
                      "flex h-12 items-center justify-center rounded-md border text-sm font-semibold transition",
                      active
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                        : "border-white/[0.08] bg-[#111111] text-zinc-400 hover:border-white/20 hover:text-white",
                    )}
                  >
                    {method.name}
                  </button>
                );
              })}
            </div>
          </section>

          {paymentMethod === "dinheiro" && (
            <section className="mt-5 border-t border-white/[0.08] pt-5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-zinc-400">
                    Troco para
                  </label>
                  <div className="flex h-11 items-center rounded-md border border-white/[0.08] bg-[#111111] px-3">
                    <span className="text-xs text-zinc-600">R$</span>
                    <input
                      type="number"
                      min={0}
                      value={receivedAmount}
                      onChange={(event) =>
                        setReceivedAmount(event.target.value)
                      }
                      placeholder="0,00"
                      className="min-w-0 flex-1 bg-transparent pl-2 text-sm font-medium text-white outline-none placeholder:text-zinc-700"
                    />
                  </div>
                </div>

                <div>
                  <span className="mb-2 block text-xs font-semibold text-zinc-400">
                    Troco calculado
                  </span>
                  <div className="flex h-11 items-center justify-end rounded-md border border-white/[0.08] bg-[#111111] px-3 text-sm font-semibold text-emerald-400">
                    {formatCurrency(changeAmount)}
                  </div>
                </div>
              </div>
            </section>
          )}

          {!canSubmit() && items.length > 0 && (
            <div className="mt-5 border border-yellow-400/20 bg-yellow-400/[0.06] px-3 py-3 text-xs leading-5 text-yellow-200">
              {orderType === "delivery" &&
                (!address.street || !address.number) &&
                "Preencha a rua e o número antes de finalizar."}

              {orderType === "delivery" &&
                address.street &&
                address.number &&
                !selectedDeliveryNeighborhood &&
                "Selecione o bairro para aplicar a taxa de entrega."}
            </div>
          )}

          <div className="mt-6 border-t border-white/[0.08] pt-5">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-zinc-500">Resumo</span>
              <span className="font-medium text-zinc-200">
                {selectedPaymentStatusLabel} · {selectedPaymentLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit() || isSubmitting}
              className={cn(
                "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition",
                canSubmit() && !isSubmitting
                  ? "bg-yellow-400 text-black hover:bg-yellow-300"
                  : "cursor-not-allowed bg-[#151515] text-zinc-700",
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando pedido...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Confirmar e imprimir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AdminLayout>
      <div className="min-h-screen bg-black pb-28 text-white xl:pb-4">
        <div className="mx-auto max-w-[1880px] p-3 sm:p-4">
          <header className="border-b border-white/[0.08] pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-600">
                  Painel / Novo pedido
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  {orderType === "delivery"
                    ? "Novo pedido para entrega"
                    : "atendimento de balcão"}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Selecione os produtos, ajuste o pedido e finalize o pagamento.
                </p>
              </div>

              <div className="w-full lg:w-[470px]">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                  Tipo do pedido
                </p>
                <div className="grid grid-cols-2 overflow-hidden rounded-md border border-white/[0.08] bg-[#0B0B0B] p-1">
                  {orderTypeOptions.map((option) => {
                    const active = orderType === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => changeOrderType(option.value)}
                        className={cn(
                          "min-h-[54px] rounded-[4px] px-4 text-left transition",
                          active
                            ? "bg-yellow-400 text-black"
                            : "text-zinc-400 hover:bg-white/[0.04] hover:text-white",
                        )}
                      >
                        <span className="block text-sm font-semibold">
                          {option.label}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block truncate text-[11px]",
                            active ? "text-black/60" : "text-zinc-600",
                          )}
                        >
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </header>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <main className="min-w-0 space-y-4">
              <section className="border border-white/[0.08] bg-[#0B0B0B] p-4 sm:rounded-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Dados do atendimento
                    </h2>
                    <p className="mt-1 text-xs text-zinc-600">
                      Identificação opcional no balcão e obrigatória para entrega.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {orderType !== "delivery" && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowCustomerPanel((current) => !current)
                        }
                        className={cn(
                          "flex h-10 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition",
                          showCustomerPanel || customer.name || customer.phone
                            ? "border-yellow-400/40 bg-yellow-400/[0.08] text-yellow-300"
                            : "border-white/[0.08] bg-[#111111] text-zinc-400 hover:border-white/20 hover:text-white",
                        )}
                      >
                        <UserRoundPlus className="h-3.5 w-3.5" />
                        {customer.name || "Adicionar cliente"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleClearOrder}
                      disabled={
                        items.length === 0 &&
                        discount === 0 &&
                        !customer.name &&
                        !customer.phone &&
                        !customer.observation
                      }
                      className="flex h-10 items-center gap-2 rounded-md border border-white/[0.08] bg-[#111111] px-3 text-xs font-semibold text-zinc-500 transition hover:border-red-500/30 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Limpar
                    </button>
                  </div>
                </div>

                {(showCustomerPanel || orderType === "delivery") && (
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-zinc-500">
                        Nome do cliente
                      </label>
                      <input
                        type="text"
                        value={customer.name}
                        onChange={(event) =>
                          setCustomer({
                            ...customer,
                            name: event.target.value,
                          })
                        }
                        placeholder={
                          orderType === "delivery"
                            ? "Digite o nome do cliente"
                            : "Opcional"
                        }
                        className="h-11 w-full rounded-md border border-white/[0.08] bg-[#111111] px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-yellow-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-zinc-500">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        value={customer.phone}
                        onChange={(event) =>
                          setCustomer({
                            ...customer,
                            phone: event.target.value,
                          })
                        }
                        placeholder="Opcional"
                        className="h-11 w-full rounded-md border border-white/[0.08] bg-[#111111] px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-yellow-400/50"
                      />
                    </div>
                  </div>
                )}
              </section>

              {orderType === "delivery" && (
                <section className="border border-white/[0.08] bg-[#0B0B0B] p-4 sm:rounded-xl">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-yellow-400" />
                    <div>
                      <h2 className="text-sm font-semibold text-white">
                        Endereço da entrega
                      </h2>
                      <p className="mt-1 text-xs text-zinc-600">
                        O bairro selecionado define automaticamente a taxa.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_110px_minmax(160px,0.8fr)_minmax(190px,1fr)_minmax(140px,0.7fr)]">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-zinc-500">
                        Rua
                      </label>
                      <input
                        type="text"
                        value={address.street}
                        onChange={(event) =>
                          setAddress({
                            ...address,
                            street: event.target.value,
                          })
                        }
                        placeholder="Nome da rua"
                        className="h-11 w-full rounded-md border border-white/[0.08] bg-[#111111] px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-yellow-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-zinc-500">
                        Número
                      </label>
                      <input
                        type="text"
                        value={address.number}
                        onChange={(event) =>
                          setAddress({
                            ...address,
                            number: event.target.value,
                          })
                        }
                        placeholder="Nº"
                        className="h-11 w-full rounded-md border border-white/[0.08] bg-[#111111] px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-yellow-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-zinc-500">
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={address.complement || ""}
                        onChange={(event) =>
                          setAddress({
                            ...address,
                            complement: event.target.value,
                          })
                        }
                        placeholder="Opcional"
                        className="h-11 w-full rounded-md border border-white/[0.08] bg-[#111111] px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-yellow-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-zinc-500">
                        Bairro e taxa
                      </label>
                      <select
                        value={selectedDeliveryNeighborhoodId}
                        onChange={(event) =>
                          handleSelectDeliveryNeighborhood(event.target.value)
                        }
                        disabled={deliveryNeighborhoodOptions.length === 0}
                        className="h-11 w-full rounded-md border border-white/[0.08] bg-[#111111] px-3 text-sm text-white outline-none transition focus:border-yellow-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Selecione</option>
                        {deliveryNeighborhoodOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.neighborhood} — {formatCurrency(option.fee)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-zinc-500">
                        Cidade
                      </label>
                      <input
                        type="text"
                        value={address.city}
                        onChange={(event) =>
                          setAddress({
                            ...address,
                            city: event.target.value,
                          })
                        }
                        placeholder="Cidade"
                        className="h-11 w-full rounded-md border border-white/[0.08] bg-[#111111] px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-yellow-400/50"
                      />
                    </div>
                  </div>

                  {deliveryNeighborhoodOptions.length === 0 && (
                    <p className="mt-3 border border-yellow-400/20 bg-yellow-400/[0.05] px-3 py-2.5 text-xs text-yellow-200">
                      Nenhuma área de entrega ativa foi encontrada.
                    </p>
                  )}
                </section>
              )}

              <section className="overflow-hidden border border-white/[0.08] bg-[#0B0B0B] sm:rounded-xl">
                <div className="border-b border-white/[0.08] p-4">
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_110px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Buscar produto pelo nome ou categoria"
                        className="h-12 w-full rounded-md border border-white/[0.08] bg-[#111111] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-yellow-400/50"
                      />
                    </div>

                    <button
                      type="button"
                      className="flex h-12 items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-[#111111] text-xs font-semibold text-zinc-500 transition hover:border-white/20 hover:text-white"
                    >
                      <Barcode className="h-4 w-4" />
                      Código
                    </button>
                  </div>

                  <div className="mt-4 flex gap-1 overflow-x-auto border-b border-white/[0.07]">
                    {categories.map((category) => {
                      const active = selectedCategory === category.id;
                      const count =
                        category.id === "all"
                          ? products.length
                          : products.filter(
                              (product) => product.category === category.id,
                            ).length;

                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setSelectedCategory(category.id)}
                          className={cn(
                            "relative shrink-0 px-3 py-3 text-sm font-medium transition",
                            active
                              ? "text-yellow-400"
                              : "text-zinc-500 hover:text-zinc-200",
                          )}
                        >
                          {category.id === "all" ? "Todos" : category.name}
                          <span className="ml-1.5 text-[11px] text-zinc-700">
                            {count}
                          </span>
                          {active && (
                            <span className="absolute inset-x-2 bottom-0 h-0.5 bg-yellow-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-4 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-white">
                        Produtos
                      </h2>
                      <p className="mt-1 text-xs text-zinc-600">
                        {filteredProducts.length} produto(s) disponível(is)
                      </p>
                    </div>

                    {searchTerm.trim() && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="text-xs font-medium text-zinc-500 transition hover:text-white"
                      >
                        Limpar busca
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {filteredProducts.map((product) => {
                      const groups = getProductGroups(product);
                      const quantityInOrder = items
                        .filter((item) => item.productId === product.id)
                        .reduce(
                          (sum, item) => sum + Number(item.quantity || 0),
                          0,
                        );

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => openProductCustomization(product)}
                          className="group relative flex min-h-[104px] overflow-hidden rounded-lg border border-white/[0.08] bg-[#101010] p-2.5 text-left transition hover:border-white/20 hover:bg-[#141414]"
                        >
                          <div className="h-[82px] w-[88px] shrink-0 overflow-hidden rounded-md bg-[#181818]">
                            <img
                              src={getProductImage(product)}
                              alt={product.name}
                              className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                              onError={(event) => {
                                event.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          </div>

                          <div className="ml-3 flex min-w-0 flex-1 flex-col justify-between py-0.5">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                                  {product.name}
                                </h3>
                                {quantityInOrder > 0 && (
                                  <span className="shrink-0 rounded bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                                    {quantityInOrder}x
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 line-clamp-1 text-[11px] text-zinc-600">
                                {groups.length > 0
                                  ? "Possui complementos"
                                  : product.categoryName || "Produto"}
                              </p>
                            </div>

                            <p className="text-base font-semibold text-yellow-400">
                              {formatCurrency(Number(product.price || 0))}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {filteredProducts.length === 0 && (
                    <div className="flex min-h-[250px] flex-col items-center justify-center border border-dashed border-white/[0.08] bg-[#0E0E0E] px-6 text-center">
                      <Search className="h-7 w-7 text-zinc-700" />
                      <h3 className="mt-3 text-sm font-semibold text-zinc-300">
                        Nenhum produto encontrado
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        Tente outra categoria ou altere o termo da busca.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </main>

            <aside className="hidden xl:sticky xl:top-4 xl:block xl:h-[calc(100vh-32px)]">
              {renderOrderPanel(false)}
            </aside>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#090909]/95 p-3 backdrop-blur-xl xl:hidden">
        <button
          type="button"
          onClick={() => setShowMobileOrder(true)}
          className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between rounded-md bg-yellow-400 px-4 text-black shadow-2xl"
        >
          <div className="flex items-center gap-3 text-left">
            <ShoppingCart className="h-5 w-5" />
            <div>
              <p className="text-[11px] font-semibold text-black/60">
                {totalItems} {totalItems === 1 ? "item" : "itens"}
              </p>
              <p className="text-lg font-semibold tracking-tight">
                {formatCurrency(total)}
              </p>
            </div>
          </div>

          <span className="flex items-center gap-2 text-sm font-semibold">
            Abrir pedido
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      </div>

      {showMobileOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm xl:hidden">
          <div className="absolute inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[460px]">
            {renderOrderPanel(true)}
          </div>
        </div>
      )}

      {customizingProduct && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/[0.08] bg-[#0B0B0B] shadow-2xl sm:rounded-xl">
            <div className="flex items-start justify-between border-b border-white/[0.08] p-4 sm:p-5">
              <div className="flex min-w-0 gap-3">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-[#151515]">
                  <img
                    src={getProductImage(customizingProduct)}
                    alt={customizingProduct.name}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    {editingItemId ? "Editar item" : "Personalizar item"}
                  </p>
                  <h3 className="mt-1 line-clamp-2 text-lg font-semibold text-white">
                    {customizingProduct.name}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-yellow-400">
                    {formatCurrency(customProductUnitPrice)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={resetCustomization}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-[#111111] text-zinc-500 transition hover:text-white"
                aria-label="Fechar personalização"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {customizingGroups.length > 0 && (
                <div className="space-y-6">
                  {customizingGroups.map((group) => {
                    const selectedIds =
                      selectedModifierOptions[group.id] || [];
                    const selectionText = group.required
                      ? `Escolha de ${group.minSelect} até ${group.maxSelect}`
                      : `Opcional · escolha até ${group.maxSelect}`;

                    return (
                      <section key={group.id}>
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-white">
                              {group.name}
                            </h4>
                            <p className="mt-1 text-xs text-zinc-600">
                              {selectionText}
                            </p>
                          </div>

                          {group.required && (
                            <span className="text-[11px] font-semibold text-yellow-400">
                              Obrigatório
                            </span>
                          )}
                        </div>

                        <div className="overflow-hidden rounded-md border border-white/[0.08]">
                          {group.options.map((option, optionIndex) => {
                            const active = selectedIds.includes(option.id);

                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                  toggleModifierOption(group, option)
                                }
                                className={cn(
                                  "flex w-full items-center justify-between gap-4 bg-[#101010] px-3 py-3 text-left transition",
                                  optionIndex > 0 &&
                                    "border-t border-white/[0.07]",
                                  active
                                    ? "bg-yellow-400/[0.08]"
                                    : "hover:bg-[#141414]",
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-3">
                                  <span
                                    className={cn(
                                      "flex h-5 w-5 shrink-0 items-center justify-center border",
                                      group.maxSelect <= 1
                                        ? "rounded-full"
                                        : "rounded-[4px]",
                                      active
                                        ? "border-yellow-400 bg-yellow-400 text-black"
                                        : "border-white/15 bg-[#0B0B0B]",
                                    )}
                                  >
                                    {active && <Check className="h-3 w-3" />}
                                  </span>
                                  <span className="truncate text-sm font-medium text-zinc-200">
                                    {option.name}
                                  </span>
                                </span>

                                <span className="shrink-0 text-sm font-medium text-zinc-400">
                                  {Number(option.price || 0) > 0
                                    ? `+ ${formatCurrency(option.price)}`
                                    : "Sem acréscimo"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              <section
                className={cn(
                  customizingGroups.length > 0 &&
                    "mt-6 border-t border-white/[0.08] pt-6",
                )}
              >
                <label className="block text-sm font-semibold text-white">
                  Observação do item
                </label>
                <p className="mt-1 text-xs text-zinc-600">
                  Use somente para alterações específicas deste produto.
                </p>
                <textarea
                  value={customizingObservation}
                  onChange={(event) =>
                    setCustomizingObservation(event.target.value)
                  }
                  placeholder="Ex.: sem cebola, molho separado..."
                  rows={3}
                  className="mt-3 w-full resize-none rounded-md border border-white/[0.08] bg-[#111111] px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-yellow-400/50"
                />
              </section>
            </div>

            <div className="border-t border-white/[0.08] bg-[#090909] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex h-11 w-fit items-center overflow-hidden rounded-md border border-white/[0.08] bg-[#111111]">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomizingQuantity((current) =>
                        Math.max(1, current - 1),
                      )
                    }
                    className="flex h-11 w-11 items-center justify-center text-zinc-500 transition hover:bg-white/[0.04] hover:text-white"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span className="w-12 text-center text-base font-semibold text-white">
                    {customizingQuantity}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCustomizingQuantity((current) => current + 1)
                    }
                    className="flex h-11 w-11 items-center justify-center text-zinc-500 transition hover:bg-white/[0.04] hover:text-white"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={confirmCustomProduct}
                  disabled={!canAddCustomProduct()}
                  className={cn(
                    "flex h-12 flex-1 items-center justify-center rounded-md px-5 text-sm font-semibold transition sm:max-w-[330px]",
                    canAddCustomProduct()
                      ? "bg-yellow-400 text-black hover:bg-yellow-300"
                      : "cursor-not-allowed bg-[#151515] text-zinc-700",
                  )}
                >
                  {editingItemId ? "Salvar alterações" : "Adicionar ao pedido"}
                  <span className="ml-2">{formatCurrency(customProductTotal)}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
