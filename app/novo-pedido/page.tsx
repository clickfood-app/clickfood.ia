"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import AdminLayout from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { initialCategories } from "@/lib/products-data";
import {
  type OrderType,
  type PaymentMethod,
  type OrderItem,
  type OrderItemDraft,
  type CustomerData,
  type DeliveryAddress,
} from "@/lib/order-types";
import ProductCatalog from "@/components/novo-pedido/ProductCatalog";
import OrderPanel from "@/components/novo-pedido/OrderPanel";
import CustomerDeliveryFields from "@/components/novo-pedido/CustomerDeliveryFields";
import PaymentStep from "@/components/novo-pedido/PaymentStep";
import ProductCustomizationDialog from "@/components/novo-pedido/ProductCustomizationDialog";
import {
  formatCurrency,
  getProductGroups,
  type DeliveryNeighborhoodOption,
  type ManualModifierGroup,
  type ManualModifierOption,
  type PaymentStatus,
  type ProductWithModifiers,
} from "@/components/novo-pedido/shared";

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

type RawModifierGroupRow = Record<string, unknown>;
type RawModifierOptionRow = Record<string, unknown>;
type RawModifierLinkRow = Record<string, unknown>;

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

function getCategoryKey(categoryName: string) {
  return `category:${categoryName.trim().toLocaleLowerCase("pt-BR")}`;
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

      const [
        { data: productsData, error: productsError },
        { data: deliveryFeeRulesData, error: deliveryFeeRulesError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("restaurant_id", restaurant.id),
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

          const categoryName = legacyCategoryName || "Sem categoria";

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

      toast({
        title: "Pedido criado com sucesso!",
        description: `Pedido #${createdOrder.public_order_number} foi salvo.`,
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

  const isOrderEmpty =
    items.length === 0 &&
    discount === 0 &&
    !customer.name &&
    !customer.phone &&
    !customer.observation;

  const paymentBlockingMessage =
    items.length > 0 && !canSubmit()
      ? orderType === "delivery" && (!address.street || !address.number)
        ? "Preencha a rua e o número antes de finalizar."
        : orderType === "delivery" && !selectedDeliveryNeighborhood
          ? "Selecione o bairro para aplicar a taxa de entrega."
          : null
      : null;

  const detailsSection = (
    <CustomerDeliveryFields
      orderType={orderType}
      customer={customer}
      onCustomerChange={setCustomer}
      showCustomerFields={showCustomerPanel}
      onToggleCustomerFields={() => setShowCustomerPanel((current) => !current)}
      address={address}
      onAddressChange={setAddress}
      neighborhoodOptions={deliveryNeighborhoodOptions}
      selectedNeighborhoodId={selectedDeliveryNeighborhoodId}
      onSelectNeighborhood={handleSelectDeliveryNeighborhood}
      selectedNeighborhood={selectedDeliveryNeighborhood}
    />
  );

  const paymentStep = (
    <PaymentStep
      orderType={orderType}
      totalItems={totalItems}
      total={total}
      customerName={customer.name}
      deliveryNeighborhoodName={selectedDeliveryNeighborhood?.neighborhood || null}
      paymentStatus={paymentStatus}
      onPaymentStatusChange={setPaymentStatus}
      paymentMethod={paymentMethod}
      onPaymentMethodChange={(method) => {
        setPaymentMethod(method);

        if (method !== "dinheiro") {
          setReceivedAmount("");
        }
      }}
      receivedAmount={receivedAmount}
      onReceivedAmountChange={setReceivedAmount}
      changeAmount={changeAmount}
      canSubmit={canSubmit()}
      blockingMessage={paymentBlockingMessage}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
    />
  );

  const orderPanel = (mobile: boolean) => (
    <OrderPanel
      mobile={mobile}
      orderType={orderType}
      items={items}
      totalItems={totalItems}
      showPaymentStep={showPaymentStep}
      isOrderEmpty={isOrderEmpty}
      details={detailsSection}
      paymentStep={paymentStep}
      subtotal={subtotal}
      deliveryFee={finalDeliveryFee}
      deliveryNeighborhoodName={selectedDeliveryNeighborhood?.neighborhood || null}
      discount={discount}
      onDiscountChange={setDiscount}
      total={total}
      onUpdateQuantity={handleUpdateQuantity}
      onEditItem={openItemEditor}
      onRemoveItem={handleRemoveItem}
      onClear={handleClearOrder}
      onBackToOrder={() => setShowPaymentStep(false)}
      onContinueToPayment={() => setShowPaymentStep(true)}
      onClose={() => setShowMobileOrder(false)}
    />
  );

  return (
    <AdminLayout>
      <div className="grid h-[calc(100dvh-6rem)] grid-cols-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-[#050505] text-zinc-100 md:h-[calc(100dvh-7rem)] xl:grid-cols-[minmax(0,1fr)_440px] xl:grid-rows-1 xl:rounded-2xl xl:border xl:border-white/[0.08]">
        <ProductCatalog
          orderType={orderType}
          onOrderTypeChange={changeOrderType}
          products={products}
          filteredProducts={filteredProducts}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          items={items}
          onSelectProduct={openProductCustomization}
        />

        <aside className="hidden min-h-0 border-l border-white/[0.07] xl:flex xl:flex-col">
          {orderPanel(false)}
        </aside>

        {/* Celular e tablet: barra com o total que abre a comanda em tela cheia. */}
        <div className="shrink-0 border-t border-white/[0.07] bg-[#080808] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:hidden">
          <button
            type="button"
            onClick={() => setShowMobileOrder(true)}
            aria-haspopup="dialog"
            className="flex h-14 w-full items-center justify-between rounded-2xl bg-yellow-400 px-4 text-black shadow-lg shadow-yellow-400/15 transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            <span className="flex items-center gap-3 text-left">
              <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-black/10 px-2 text-sm font-black tabular-nums">
                {totalItems}
              </span>
              <span>
                <span className="block text-[11px] font-semibold text-black/60">
                  {totalItems === 1 ? "item na comanda" : "itens na comanda"}
                </span>
                <span className="block text-lg font-black tabular-nums tracking-tight">{formatCurrency(total)}</span>
              </span>
            </span>

            <span className="flex items-center gap-1.5 text-sm font-bold">
              Ver pedido
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>

      {showMobileOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm xl:hidden">
          <div className="absolute inset-0 bg-[#080808] sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[480px] sm:border-l sm:border-white/[0.08]">
            {orderPanel(true)}
          </div>
        </div>
      )}

      {customizingProduct && (
        <ProductCustomizationDialog
          product={customizingProduct}
          editing={Boolean(editingItemId)}
          quantity={customizingQuantity}
          observation={customizingObservation}
          selectedOptions={selectedModifierOptions}
          unitPrice={customProductUnitPrice}
          totalPrice={customProductTotal}
          canConfirm={canAddCustomProduct()}
          onClose={resetCustomization}
          onQuantityChange={setCustomizingQuantity}
          onObservationChange={setCustomizingObservation}
          onToggleOption={toggleModifierOption}
          onConfirm={confirmCustomProduct}
        />
      )}
    </AdminLayout>
  );
}
