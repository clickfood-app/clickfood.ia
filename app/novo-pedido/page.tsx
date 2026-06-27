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
  Banknote,
  Barcode,
  Check,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  MessageSquare,
  Minus,
  Percent,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  User,
  Wallet,
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
  modifierGroups?: ManualModifierGroup[];
  modifier_groups?: ManualModifierGroup[];
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
        `${modifier.groupId || modifier.groupName}:${modifier.optionId || modifier.optionName}:${modifier.optionPrice}`,
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
            rule.max_distance_km === null || rule.max_distance_km === undefined
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

  const [orderType, setOrderType] = useState<OrderType>("pickup" as OrderType);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("pending");
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

  const [showObservationPanel, setShowObservationPanel] = useState(false);

  const [customizingProduct, setCustomizingProduct] =
    useState<ProductWithModifiers | null>(null);
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
              supabase.from("modifier_groups").select("*").in("id", groupIds),
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

            const optionsByGroupId = new Map<string, ManualModifierOption[]>();

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

            ((groupRows || []) as RawModifierGroupRow[]).forEach((groupRow) => {
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
            });

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
                  modifierGroupsByProductId.set(productId, currentGroups);
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
            await supabase.from("product_modifier_options").select("*");

          if (legacyOptionError) {
            console.warn(
              "Opções antigas de complementos não carregadas:",
              legacyOptionError.message,
            );
          }

          const legacyOptions = (
            (legacyOptionRows || []) as RawModifierOptionRow[]
          ).filter(isActiveRow);

          const optionsByGroupId = new Map<string, ManualModifierOption[]>();

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
                modifierGroupsByProductId.set(productId, currentGroups);
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
          const category =
            getStringField(
              product,
              ["category", "category_name", "category_title"],
              "Sem categoria",
            ) || "Sem categoria";

          const productId = String(product.id);
          const modifierGroups = modifierGroupsByProductId.get(productId) || [];

          return {
            id: productId,
            name: getStringField(product, ["name"], "Produto sem nome"),
            description: getStringField(product, ["description"], ""),
            price: getNumberField(product, ["price"], 0),
            cost: getNumberField(product, ["cost"], 0),
            category,
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
            order: getNumberField(product, ["sort_order", "order"], 0),
            modifierGroups,
            modifier_groups: modifierGroups,
          } as ProductWithModifiers;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const productCategories = Array.from(
        new Set(
          availableProducts
            .map((product) => product.category || "Sem categoria")
            .filter(Boolean),
        ),
      );

      const categoryTemplate = initialCategories[0] || {
        id: "all",
        name: "Todos",
        active: true,
        order: 0,
      };

      setProducts(availableProducts);

      setCategories([
        {
          ...categoryTemplate,
          id: "all",
          name: "Todos",
          active: true,
          order: 0,
        },
        ...productCategories.map((category, index) => ({
          ...categoryTemplate,
          id: category,
          name: category,
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

  const selectedDeliveryNeighborhood = deliveryNeighborhoodOptions.find(
    (option) => option.id === selectedDeliveryNeighborhoodId,
  );

  const finalDeliveryFee =
    orderType === "delivery" ? selectedDeliveryNeighborhood?.fee || 0 : 0;

  const total = Math.max(0, subtotal + finalDeliveryFee - discount);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;

      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        String(product.category || "")
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
      const selectedIds = selectedModifierOptions[group.id] || [];
      const groupTotal = group.options
        .filter((option) => selectedIds.includes(option.id))
        .reduce((optionSum, option) => optionSum + Number(option.price || 0), 0);

      return sum + groupTotal;
    }, 0);
  }, [customizingProduct, customizingGroups, selectedModifierOptions]);

  const customProductUnitPrice =
    Number(customizingProduct?.price || 0) + selectedModifierTotal;

  const customProductTotal =
    customProductUnitPrice * Math.max(1, customizingQuantity);

  const changeAmount = Math.max(0, Number(receivedAmount || 0) - total);

  const selectedPaymentLabel =
    paymentMethod === "pix"
      ? "Pix"
      : paymentMethod === "dinheiro"
        ? "Dinheiro"
        : paymentMethod === "credito"
          ? "Crédito"
          : paymentMethod === "debito"
            ? "Débito"
            : "Pendente";

  const changeOrderType = (type: OrderType) => {
    setOrderType(type);

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

  const handleSelectDeliveryNeighborhood = (optionId: string) => {
    const selectedOption = deliveryNeighborhoodOptions.find(
      (option) => option.id === optionId,
    );

    setSelectedDeliveryNeighborhoodId(optionId);

    setAddress((currentAddress) => ({
      ...currentAddress,
      neighborhood: selectedOption?.neighborhood || "",
    }));
  };

  const handleAddProduct = useCallback((itemDraft: OrderItemDraft) => {
    setItems((prev) => {
      const draft: OrderItemDraft = {
        ...itemDraft,
        quantity: Math.max(1, Number(itemDraft.quantity || 1)),
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
            ? { ...item, quantity: item.quantity + Number(draft.quantity || 1) }
            : item,
        );
      }

      return [
        ...prev,
        {
          id: `item-${Date.now()}-${draft.productId}-${Math.random()
            .toString(36)
            .slice(2)}`,
          productId: draft.productId,
          name: draft.name,
          price: Number(draft.price || 0),
          quantity: Number(draft.quantity || 1),
          observation: draft.observation || "",
          modifiers: draft.modifiers || [],
        },
      ];
    });
  }, []);

  const openProductCustomization = (product: ProductWithModifiers) => {
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

    setCustomizingProduct(product);
    setCustomizingQuantity(1);
    setCustomizingObservation("");
    setSelectedModifierOptions({});
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
          [group.id]: current.filter((optionId) => optionId !== option.id),
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
      const selectedIds = selectedModifierOptions[group.id] || [];
      return selectedIds.length >= group.minSelect;
    });
  };

  const confirmCustomProduct = () => {
    if (!customizingProduct) return;

    if (!canAddCustomProduct()) {
      toast({
        title: "Complemento obrigatório",
        description: "Selecione os complementos obrigatórios para continuar.",
        variant: "destructive",
      });

      return;
    }

    const modifiers = customizingGroups.flatMap((group) => {
      const selectedIds = selectedModifierOptions[group.id] || [];

      return group.options
        .filter((option) => selectedIds.includes(option.id))
        .map((option) => ({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          optionPrice: Number(option.price || 0),
        }));
    });

    handleAddProduct({
      productId: customizingProduct.id,
      name: customizingProduct.name,
      price: customProductUnitPrice,
      quantity: customizingQuantity,
      observation: customizingObservation.trim(),
      modifiers,
    });

    setCustomizingProduct(null);
    setSelectedModifierOptions({});
    setCustomizingObservation("");
    setCustomizingQuantity(1);
  };

  const handleUpdateQuantity = useCallback(
    (itemId: string, quantity: number) => {
      if (quantity <= 0) {
        setItems((prev) => prev.filter((item) => item.id !== itemId));
        return;
      }

      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
      );
    },
    [],
  );

  const handleUpdateObservation = useCallback(
    (itemId: string, observation: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, observation } : item,
        ),
      );
    },
    [],
  );

  const handleRemoveItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const handleClearOrder = () => {
    setItems([]);
    setDiscount(0);
    setPaymentMethod("pending");
    setReceivedAmount("");
    setSelectedDeliveryNeighborhoodId("");
    setShowObservationPanel(false);
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
      if (!address.street || !address.number || !address.neighborhood) {
        return false;
      }

      if (!selectedDeliveryNeighborhood) return false;
    }

    return true;
  };

  const handleSubmit = async (paymentOverride?: PaymentMethod) => {
    if (!canSubmit()) return;

    if (!restaurantId) {
      toast({
        title: "Restaurante não encontrado",
        description: "Não foi possível identificar o restaurante logado.",
        variant: "destructive",
      });

      return;
    }

    const selectedPaymentMethod = paymentOverride || paymentMethod;

    try {
      setIsSubmitting(true);

      const publicOrderNumber = Date.now().toString().slice(-6);

      const addressText =
        orderType === "delivery"
          ? `${address.street}, ${address.number}${
              address.complement ? ` - ${address.complement}` : ""
            } - ${address.neighborhood}${
              address.city ? `, ${address.city}` : ""
            }`
          : "";

      const orderModeNote =
        orderType === "delivery" ? "Pedido delivery" : "Pedido balcão";

      const deliveryFeeNote =
        orderType === "delivery" && selectedDeliveryNeighborhood
          ? `Taxa de entrega | Bairro: ${
              selectedDeliveryNeighborhood.neighborhood
            } | Regra: ${
              selectedDeliveryNeighborhood.label
            } | Valor: ${formatCurrency(selectedDeliveryNeighborhood.fee)}`
          : "";

      const paymentNote =
        selectedPaymentMethod === "dinheiro" && receivedAmount
          ? `Pagamento em dinheiro | Recebido: ${formatCurrency(
              Number(receivedAmount || 0),
            )} | Troco: ${formatCurrency(
              Math.max(0, Number(receivedAmount || 0) - total),
            )}`
          : "";

      const orderNotes = [
        orderModeNote,
        customer.observation ? `Obs: ${customer.observation}` : "",
        orderType === "delivery" ? `Endereço: ${addressText}` : "",
        deliveryFeeNote,
        paymentNote,
      ]
        .filter(Boolean)
        .join("\n");

      const { data: createdOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurantId,
          public_order_number: publicOrderNumber,
          customer_name: customer.name || "Cliente balcão",
          customer_phone: customer.phone || "Não informado",
          status: "pending",
          subtotal,
          discount,
          delivery_fee: finalDeliveryFee,
          total,
          payment_method: selectedPaymentMethod,
          payment_status:
            selectedPaymentMethod === "pending" ? "pending" : "paid",
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
        await supabase.from("orders").delete().eq("id", createdOrder.id);
        throw itemsError;
      }

      let printJobWarning: string | null = null;

      try {
        const { data: printJobResult, error: printJobError } =
          await supabase.rpc("create_order_print_job_for_order", {
            p_order_id: createdOrder.id,
            p_force_reprint: false,
          });

        if (printJobError) {
          throw printJobError;
        }

        const result = printJobResult as {
          success?: boolean;
          error?: string;
        } | null;

        if (result?.success === false) {
          throw new Error(result.error || "Erro ao criar job de impressão.");
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
        variant: printJobWarning ? "destructive" : "default",
      });

      router.push("/pedidos");
    } catch (err) {
      const errorMessage = getSupabaseErrorMessage(
        err,
        "Não foi possível salvar o pedido no sistema.",
      );

      console.error("Erro ao criar pedido manual:", errorMessage);
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
      icon: Store,
    },
    {
      value: "delivery" as OrderType,
      label: "Entrega",
      icon: Truck,
    },
  ];

  const paymentOptions = [
    {
      id: "pix" as PaymentMethod,
      name: "Pix",
      icon: QrCode,
    },
    {
      id: "dinheiro" as PaymentMethod,
      name: "Dinheiro",
      icon: Banknote,
    },
    {
      id: "credito" as PaymentMethod,
      name: "Crédito",
      icon: CreditCard,
    },
    {
      id: "debito" as PaymentMethod,
      name: "Débito",
      icon: CreditCard,
    },
    {
      id: "pending" as PaymentMethod,
      name: "Pendente",
      icon: Clock,
    },
  ];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#070707] p-2 text-white sm:p-3 lg:p-4">
        <div className="mx-auto max-w-[1900px] space-y-3">
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-black shadow-sm">
                  <Receipt className="h-5 w-5" />
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                    <span>Painel</span>
                    <span>/</span>
                    <span className="text-white">PDV</span>
                  </div>
                  <h1 className="text-xl font-black text-white">
                    Atendimento rápido
                  </h1>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[760px]">
                {orderTypeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = orderType === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => changeOrderType(option.value)}
                      className={cn(
                        "flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition",
                        active
                          ? "border-yellow-400 bg-yellow-400 text-black shadow-sm"
                          : "border-white/10 bg-[#111111] text-zinc-400 hover:border-yellow-400/40 hover:text-yellow-400",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}

                <div className="hidden h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111111] text-sm font-bold text-zinc-400 sm:flex">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Caixa aberto
                </div>

                <div className="hidden h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111111] text-sm font-bold text-zinc-400 sm:flex">
                  <Printer className="h-4 w-4" />
                  Impressora online
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[170px_minmax(0,1fr)_410px]">
            <aside className="hidden rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm xl:block xl:sticky xl:top-4 xl:h-[calc(100vh-32px)]">
              <div className="mb-3 px-2 text-xs font-black uppercase tracking-wide text-zinc-500">
                Categorias
              </div>

              <div className="space-y-2 overflow-y-auto pr-1">
                {categories.map((category) => {
                  const active = selectedCategory === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategory(category.id)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between rounded-xl border px-3 text-left text-sm font-black transition",
                        active
                          ? "border-yellow-400 bg-yellow-400 text-black shadow-sm"
                          : "border-white/10 bg-[#111111] text-zinc-400 hover:border-yellow-400/40 hover:text-yellow-400",
                      )}
                    >
                      <span className="truncate">{category.name}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_190px_170px_44px]">
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={customer.name}
                      onChange={(event) =>
                        setCustomer({
                          ...customer,
                          name: event.target.value,
                        })
                      }
                      placeholder="Cliente balcão"
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#111111] pl-10 pr-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400/40 focus:ring-2 focus:ring-yellow-400/20"
                    />
                  </div>

                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(event) =>
                      setCustomer({
                        ...customer,
                        phone: event.target.value,
                      })
                    }
                    placeholder="Telefone"
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400/40 focus:ring-2 focus:ring-yellow-400/20"
                  />

                  <button
                    type="button"
                    onClick={() => setShowObservationPanel((prev) => !prev)}
                    className={cn(
                      "flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition",
                      showObservationPanel || customer.observation
                        ? "border-yellow-400 bg-yellow-400 text-black"
                        : "border-white/10 bg-[#111111] text-zinc-400 hover:border-yellow-400/40 hover:text-yellow-400",
                    )}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Observação
                  </button>

                  <button
                    type="button"
                    onClick={handleClearOrder}
                    disabled={
                      items.length === 0 &&
                      discount === 0 &&
                      !customer.name &&
                      !customer.phone
                    }
                    className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-[#111111] text-zinc-500 transition hover:border-red-500/40 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Limpar pedido"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {showObservationPanel && (
                  <textarea
                    value={customer.observation || ""}
                    onChange={(event) =>
                      setCustomer({
                        ...customer,
                        observation: event.target.value,
                      })
                    }
                    placeholder="Observação geral do pedido. Ex: pedido para viagem, sem cebola, entregar no portão..."
                    rows={2}
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#111111] px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400/40 focus:ring-2 focus:ring-yellow-400/20"
                  />
                )}
              </div>

              {orderType === "delivery" && (
                <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-yellow-400">
                    <MapPin className="h-4 w-4" />
                    Dados da entrega
                  </div>

                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_110px_170px_220px_160px]">
                    <input
                      type="text"
                      value={address.street}
                      onChange={(event) =>
                        setAddress({
                          ...address,
                          street: event.target.value,
                        })
                      }
                      placeholder="Rua"
                      className="h-11 rounded-xl border border-yellow-400/20 bg-[#0A0A0A] px-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20"
                    />

                    <input
                      type="text"
                      value={address.number}
                      onChange={(event) =>
                        setAddress({
                          ...address,
                          number: event.target.value,
                        })
                      }
                      placeholder="Número"
                      className="h-11 rounded-xl border border-yellow-400/20 bg-[#0A0A0A] px-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20"
                    />

                    <input
                      type="text"
                      value={address.complement || ""}
                      onChange={(event) =>
                        setAddress({
                          ...address,
                          complement: event.target.value,
                        })
                      }
                      placeholder="Complemento"
                      className="h-11 rounded-xl border border-yellow-400/20 bg-[#0A0A0A] px-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20"
                    />

                    <select
                      value={selectedDeliveryNeighborhoodId}
                      onChange={(event) =>
                        handleSelectDeliveryNeighborhood(event.target.value)
                      }
                      disabled={deliveryNeighborhoodOptions.length === 0}
                      className="h-11 rounded-xl border border-yellow-400/20 bg-[#0A0A0A] px-3 text-sm font-bold text-white outline-none transition focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Bairro / taxa</option>
                      {deliveryNeighborhoodOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.neighborhood} - {formatCurrency(option.fee)}
                        </option>
                      ))}
                    </select>

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
                      className="h-11 rounded-xl border border-yellow-400/20 bg-[#0A0A0A] px-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20"
                    />
                  </div>

                  {deliveryNeighborhoodOptions.length === 0 && (
                    <p className="mt-2 rounded-xl bg-[#0A0A0A] px-3 py-2 text-xs font-semibold text-yellow-400">
                      Nenhuma área de entrega ativa cadastrada.
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_120px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Buscar produto..."
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#111111] pl-10 pr-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400/40 focus:ring-2 focus:ring-yellow-400/20"
                    />
                  </div>

                  <button
                    type="button"
                    className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111111] text-sm font-black text-zinc-400 transition hover:border-yellow-400/40 hover:text-yellow-400"
                  >
                    <Barcode className="h-5 w-5" />
                    Código
                  </button>
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 xl:hidden">
                  {categories.map((category) => {
                    const active = selectedCategory === category.id;

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategory(category.id)}
                        className={cn(
                          "h-10 whitespace-nowrap rounded-xl border px-3 text-xs font-black transition",
                          active
                            ? "border-yellow-400 bg-yellow-400 text-black shadow-sm"
                            : "border-white/10 bg-[#111111] text-zinc-400 hover:border-yellow-400/40 hover:text-yellow-400",
                        )}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-black text-white">
                      Produtos
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Clique no produto para adicionar ao pedido.
                    </p>
                  </div>

                  <span className="rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-400">
                    {filteredProducts.length} de {products.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                  {filteredProducts.map((product) => {
                    const groups = getProductGroups(product);

                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => openProductCustomization(product)}
                        className="group flex min-h-[88px] rounded-xl border border-white/10 bg-[#111111] p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-yellow-400/40 hover:bg-[#161616]"
                      >
                        <div className="h-[68px] w-[74px] shrink-0 overflow-hidden rounded-xl bg-[#0A0A0A]">
                          <img
                            src={getProductImage(product)}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.src = "/placeholder.svg";
                            }}
                          />
                        </div>

                        <div className="ml-3 flex min-w-0 flex-1 flex-col justify-between">
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="line-clamp-2 text-sm font-black leading-tight text-white">
                                {product.name}
                              </h3>

                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-400 text-black shadow-sm transition group-hover:bg-yellow-300">
                                <Plus className="h-4 w-4" />
                              </span>
                            </div>

                            <p className="mt-1 line-clamp-1 text-[11px] font-medium text-zinc-500">
                              {groups.length > 0
                                ? "Tem opções"
                                : product.description ||
                                  product.category ||
                                  "Produto"}
                            </p>
                          </div>

                          <div className="text-base font-black text-yellow-400">
                            {formatCurrency(Number(product.price || 0))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {filteredProducts.length === 0 && (
                  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#111111] text-center">
                    <Search className="h-10 w-10 text-zinc-500" />
                    <h3 className="mt-3 text-sm font-bold text-white">
                      Nenhum produto encontrado
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      Tente buscar por outro nome ou categoria.
                    </p>
                  </div>
                )}
              </div>
            </main>

            <aside className="xl:sticky xl:top-4 xl:h-[calc(100vh-32px)]">
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-sm">
                <div className="flex items-center justify-between border-b border-white/10 p-4">
                  <div>
                    <h2 className="text-base font-black text-white">
                      Pedido atual
                    </h2>
                    <p className="text-xs font-semibold text-zinc-500">
                      {orderType === "delivery"
                        ? selectedDeliveryNeighborhood
                          ? `Entrega • ${selectedDeliveryNeighborhood.neighborhood}`
                          : "Entrega"
                        : "Balcão"}
                    </p>
                  </div>

                  <span className="rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-400">
                    {items.length} item(ns)
                  </span>
                </div>

                <div className="min-h-[260px] flex-1 overflow-y-auto p-3">
                  {items.length === 0 ? (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#111111]">
                        <ShoppingCart className="h-8 w-8 text-zinc-500" />
                      </div>
                      <h3 className="mt-4 text-sm font-bold text-white">
                        Pedido vazio
                      </h3>
                      <p className="mt-1 max-w-[240px] text-sm text-zinc-500">
                        Adicione os produtos pelo cardápio.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-[#111111] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-black leading-tight text-white">
                                {item.name}
                              </h3>

                              {item.modifiers && item.modifiers.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {item.modifiers.map((modifier, index) => (
                                    <div
                                      key={`${item.id}-${modifier.optionId}-${index}`}
                                      className="flex items-center justify-between gap-2 rounded-lg bg-yellow-400/10 px-2 py-1 text-[11px] font-bold text-yellow-400"
                                    >
                                      <span className="truncate">
                                        + {modifier.optionName}
                                      </span>
                                      {Number(modifier.optionPrice || 0) > 0 && (
                                        <span className="shrink-0">
                                          {formatCurrency(
                                            Number(modifier.optionPrice || 0),
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {item.observation && (
                                <p className="mt-1 rounded-lg bg-yellow-400/10 px-2 py-1 text-[11px] font-semibold text-yellow-400">
                                  Obs: {item.observation}
                                </p>
                              )}
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-black text-white">
                                {formatCurrency(item.price * item.quantity)}
                              </div>
                              <div className="mt-1 text-[11px] font-bold text-zinc-500">
                                {formatCurrency(item.price)} un.
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex h-9 items-center rounded-xl border border-white/10 bg-[#0A0A0A]">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateQuantity(item.id, item.quantity - 1)
                                }
                                className="flex h-9 w-9 items-center justify-center text-zinc-500 transition hover:text-red-500"
                              >
                                <Minus className="h-4 w-4" />
                              </button>

                              <span className="w-8 text-center text-sm font-black text-white">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateQuantity(item.id, item.quantity + 1)
                                }
                                className="flex h-9 w-9 items-center justify-center text-zinc-500 transition hover:text-yellow-400"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#0A0A0A] text-zinc-500 transition hover:border-red-500/40 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-bold text-zinc-500 transition hover:text-yellow-400">
                              Observação do item
                            </summary>
                            <textarea
                              value={item.observation || ""}
                              onChange={(event) =>
                                handleUpdateObservation(item.id, event.target.value)
                              }
                              placeholder="Ex: sem cebola, bem passado..."
                              rows={2}
                              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-yellow-400/40 focus:ring-2 focus:ring-yellow-400/20"
                            />
                          </details>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Subtotal</span>
                      <span className="font-black text-white">
                        {formatCurrency(subtotal)}
                      </span>
                    </div>

                    {orderType === "delivery" && (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-zinc-500">
                          Taxa de entrega
                          {selectedDeliveryNeighborhood
                            ? ` • ${selectedDeliveryNeighborhood.neighborhood}`
                            : ""}
                        </span>
                        <span className="shrink-0 font-black text-white">
                          {selectedDeliveryNeighborhood
                            ? formatCurrency(finalDeliveryFee)
                            : "Selecione"}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-1 text-zinc-500">
                        Desconto
                        <Percent className="h-3.5 w-3.5" />
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">R$</span>
                        <input
                          type="number"
                          min={0}
                          value={discount}
                          onChange={(event) =>
                            setDiscount(
                              Math.max(0, Number(event.target.value || 0)),
                            )
                          }
                          className="h-9 w-28 rounded-xl border border-white/10 bg-[#111111] px-3 text-right text-sm font-bold text-white outline-none focus:border-yellow-400/40 focus:ring-2 focus:ring-yellow-400/20"
                        />
                      </div>
                    </div>

                    <div className="flex items-end justify-between border-t border-white/10 pt-4">
                      <span className="text-base font-black text-white">
                        Total
                      </span>
                      <span className="text-3xl font-black text-yellow-400">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {paymentOptions.map((method) => {
                      const Icon = method.icon;
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
                            "flex h-12 flex-col items-center justify-center gap-1 rounded-xl border text-[10px] font-black transition",
                            active
                              ? "border-yellow-400 bg-yellow-400 text-black"
                              : "border-white/10 bg-[#111111] text-zinc-400 hover:border-yellow-400/40 hover:text-yellow-400",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {method.name}
                        </button>
                      );
                    })}
                  </div>

                  {paymentMethod === "dinheiro" && (
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-[#111111] p-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-zinc-500">
                          Recebido
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={receivedAmount}
                          onChange={(event) =>
                            setReceivedAmount(event.target.value)
                          }
                          placeholder="0,00"
                          className="h-10 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-black text-white outline-none placeholder:text-zinc-600 focus:border-yellow-400/40 focus:ring-2 focus:ring-yellow-400/20"
                        />
                      </div>

                      <div>
                        <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-zinc-500">
                          Troco
                        </span>
                        <div className="flex h-10 items-center justify-end rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-black text-emerald-400">
                          {formatCurrency(changeAmount)}
                        </div>
                      </div>
                    </div>
                  )}

                  {!canSubmit() && items.length > 0 && (
                    <p className="mt-3 rounded-xl bg-yellow-400/10 px-3 py-2 text-center text-xs font-semibold text-yellow-400">
                      {orderType === "delivery" &&
                        (!address.street || !address.number) &&
                        "Preencha rua e número."}
                      {orderType === "delivery" &&
                        address.street &&
                        address.number &&
                        !selectedDeliveryNeighborhood &&
                        "Selecione o bairro para aplicar a taxa de entrega."}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSubmit(paymentMethod)}
                    disabled={!canSubmit() || isSubmitting}
                    className={cn(
                      "mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black shadow-sm transition",
                      canSubmit() && !isSubmitting
                        ? "bg-yellow-400 text-black hover:bg-yellow-300"
                        : "cursor-not-allowed bg-[#111111] text-zinc-500",
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Wallet className="h-5 w-5" />
                        Finalizar {selectedPaymentLabel}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {customizingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/95 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 p-5">
              <div className="flex gap-4">
                <div className="h-20 w-24 overflow-hidden rounded-2xl bg-[#111111]">
                  <img
                    src={getProductImage(customizingProduct)}
                    alt={customizingProduct.name}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                </div>

                <div>
                  <h3 className="text-xl font-black text-white">
                    {customizingProduct.name}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {customizingProduct.description ||
                      customizingProduct.category ||
                      "Configure o produto"}
                  </p>
                  <p className="mt-2 text-lg font-black text-yellow-400">
                    {formatCurrency(customProductUnitPrice)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-[#111111] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-5">
              <div className="space-y-5">
                {customizingGroups.map((group) => {
                  const selectedIds = selectedModifierOptions[group.id] || [];

                  return (
                    <div
                      key={group.id}
                      className="rounded-2xl border border-white/10 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-black text-white">
                            {group.name}
                          </h4>
                          <p className="text-xs text-zinc-500">
                            {group.required
                              ? `Obrigatório • escolha de ${group.minSelect} até ${group.maxSelect}`
                              : `Opcional • escolha até ${group.maxSelect}`}
                          </p>
                        </div>

                        {group.required && (
                          <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
                            Obrigatório
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {group.options.map((option) => {
                          const active = selectedIds.includes(option.id);

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleModifierOption(group, option)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                                active
                                  ? "border-yellow-400/40 bg-yellow-400/10 ring-2 ring-yellow-400/20"
                                  : "border-white/10 bg-[#0A0A0A] hover:border-yellow-400/40 hover:bg-[#111111]",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded-full border",
                                    active
                                      ? "border-yellow-400 bg-yellow-400 text-black"
                                      : "border-white/10 bg-[#0A0A0A]",
                                  )}
                                >
                                  {active && <Check className="h-3 w-3" />}
                                </span>

                                <span className="font-bold text-white">
                                  {option.name}
                                </span>
                              </div>

                              <span className="font-black text-white">
                                {Number(option.price || 0) > 0
                                  ? `+ ${formatCurrency(option.price)}`
                                  : "Grátis"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-2xl border border-white/10 p-4">
                  <label className="mb-2 block text-sm font-black text-white">
                    Observação do item
                  </label>
                  <textarea
                    value={customizingObservation}
                    onChange={(event) =>
                      setCustomizingObservation(event.target.value)
                    }
                    placeholder="Ex: sem cebola, molho separado..."
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-[#111111] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-yellow-400/40 focus:ring-2 focus:ring-yellow-400/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCustomizingQuantity((prev) => Math.max(1, prev - 1))
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#0A0A0A] text-zinc-500 transition hover:bg-[#111111]"
                >
                  <Minus className="h-4 w-4" />
                </button>

                <span className="flex h-11 w-16 items-center justify-center rounded-xl border border-white/10 bg-[#111111] text-lg font-black text-white">
                  {customizingQuantity}
                </span>

                <button
                  type="button"
                  onClick={() => setCustomizingQuantity((prev) => prev + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#0A0A0A] text-zinc-500 transition hover:bg-[#111111]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={confirmCustomProduct}
                disabled={!canAddCustomProduct()}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black shadow-sm transition sm:flex-none",
                  canAddCustomProduct()
                    ? "bg-yellow-400 text-black hover:bg-yellow-300"
                    : "cursor-not-allowed bg-[#111111] text-zinc-500",
                )}
              >
                <Plus className="h-5 w-5" />
                Adicionar {formatCurrency(customProductTotal)}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
