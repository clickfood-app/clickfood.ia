"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin-layout";
import OrderTypeSelector from "@/components/manual-order/order-type-selector";
import TableSelector from "@/components/manual-order/table-selector";
import ProductSearch from "@/components/manual-order/product-search";
import OrderSummary from "@/components/manual-order/order-summary";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { initialCategories, type Product } from "@/lib/products-data";
import {
  type OrderType,
  type PaymentMethod,
  type OrderItem,
  type OrderItemDraft,
  type Table,
  type CustomerData,
  type DeliveryAddress,
  initialTables,
} from "@/lib/order-types";
import {
  ShoppingCart,
  User,
  MapPin,
  Check,
  Wallet,
  QrCode,
  CreditCard,
  Clock,
  X,
  Users,
} from "lucide-react";

type RestaurantTableRow = {
  id: string;
  restaurant_id: string;
  number: string;
  name: string | null;
  capacity: number | null;
  is_active: boolean | null;
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

function isUuid(value: string | null | undefined) {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeDefaultTables() {
  return (initialTables || []).map((table, index) => {
    const rawTable = table as unknown as {
      id?: string;
      number?: string | number;
      name?: string;
      capacity?: number;
      status?: string;
    };

    const number = Number(rawTable.number || index + 1);

    return {
      ...table,
      id: String(rawTable.id || `table-${number}`),
      number,
      name: rawTable.name || `Mesa ${number}`,
      capacity: Number(rawTable.capacity || 4),
      status: "available",
    } as Table;
  });
}

function mapRestaurantTableToTable(table: RestaurantTableRow): Table {
  const number = Number(table.number);

  return {
    id: table.id,
    number,
    name: table.name || `Mesa ${number}`,
    capacity: Number(table.capacity || 4),
    status: "available",
  } as Table;
}

function getStringField(
  row: Record<string, unknown>,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
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
      if (["false", "0", "nao", "não", "no"].includes(normalized)) return false;
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

function mergeTables(defaultTables: Table[], databaseTables: Table[]) {
  const map = new Map<string, Table>();

  defaultTables.forEach((table) => {
    const number = String(
      (table as unknown as { number?: string | number }).number || table.id,
    );

    map.set(number, table);
  });

  databaseTables.forEach((table) => {
    const number = String(
      (table as unknown as { number?: string | number }).number || table.id,
    );

    map.set(number, table);
  });

  return Array.from(map.values()).sort((a, b) => {
    const aNumber = Number(
      (a as unknown as { number?: string | number }).number || 0,
    );
    const bNumber = Number(
      (b as unknown as { number?: string | number }).number || 0,
    );

    if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
      return aNumber - bNumber;
    }

    return String(a.number).localeCompare(String(b.number));
  });
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

export default function NovoPedidoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [orderType, setOrderType] = useState<OrderType>("local");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tables, setTables] = useState<Table[]>(normalizeDefaultTables());
  const [guestCount, setGuestCount] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pending");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [deliveryFee] = useState(8.0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState(initialCategories);

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
    const fetchRestaurantProductsAndTables = async () => {
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
        { data: tablesData, error: tablesError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("restaurant_id", restaurant.id),
        supabase
          .from("restaurant_tables")
          .select("id, restaurant_id, number, name, capacity, is_active")
          .eq("restaurant_id", restaurant.id)
          .eq("is_active", true),
      ]);

      if (productsError) {
        console.error("Erro ao buscar produtos:", productsError);

        toast({
          title: "Erro ao carregar produtos",
          description: "Não foi possível buscar os produtos do cardápio.",
          variant: "destructive",
        });
      }

      if (tablesError) {
        console.error("Erro ao buscar mesas:", tablesError);

        toast({
          title: "Erro ao carregar mesas",
          description: "Não foi possível buscar as mesas salvas.",
          variant: "destructive",
        });
      }

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

      const databaseTables = ((tablesData || []) as RestaurantTableRow[]).map(
        mapRestaurantTableToTable,
      );

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
      setTables(mergeTables(normalizeDefaultTables(), databaseTables));
    };

    fetchRestaurantProductsAndTables();
  }, [supabase, toast]);

  const paymentOptions = [
    {
      id: "dinheiro",
      name: "Dinheiro",
      icon: <Wallet className="mb-2 h-8 w-8" />,
    },
    {
      id: "pix",
      name: "PIX",
      icon: <QrCode className="mb-2 h-8 w-8" />,
    },
    {
      id: "credito",
      name: "Crédito",
      icon: <CreditCard className="mb-2 h-8 w-8" />,
    },
    {
      id: "debito",
      name: "Débito",
      icon: <CreditCard className="mb-2 h-8 w-8" />,
    },
    {
      id: "pending",
      name: "Pendente",
      icon: <Clock className="mb-2 h-8 w-8" />,
    },
  ];

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
          id: `item-${Date.now()}-${draft.productId}-${Math.random().toString(36).slice(2)}`,
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

  const handleCreateTable = useCallback(
    async (table: Omit<Table, "id">) => {
      if (!restaurantId) {
        toast({
          title: "Restaurante não encontrado",
          description: "Não foi possível salvar a mesa agora.",
          variant: "destructive",
        });
        return;
      }

      const rawTable = table as unknown as {
        number?: string | number;
        name?: string;
        capacity?: number;
      };

      const number = String(rawTable.number || "").trim();

      if (!number) {
        toast({
          title: "Número da mesa obrigatório",
          description: "Informe o número da mesa para cadastrar.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("restaurant_tables")
        .insert({
          restaurant_id: restaurantId,
          number,
          name: rawTable.name || `Mesa ${number}`,
          capacity: Number(rawTable.capacity || 4),
          is_active: true,
        })
        .select("id, restaurant_id, number, name, capacity, is_active")
        .single();

      if (error) {
        toast({
          title: "Erro ao criar mesa",
          description: getSupabaseErrorMessage(
            error,
            "Não foi possível salvar a nova mesa.",
          ),
          variant: "destructive",
        });
        return;
      }

      const newTable = mapRestaurantTableToTable(data as RestaurantTableRow);

      setTables((prev) => mergeTables(prev, [newTable]));
      setSelectedTable(newTable.id);

      toast({
        title: "Mesa criada",
        description: `Mesa ${newTable.number} foi salva no sistema.`,
      });
    },
    [restaurantId, supabase, toast],
  );

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const finalDeliveryFee = orderType === "delivery" ? deliveryFee : 0;
  const total = Math.max(0, subtotal + finalDeliveryFee - discount);

  const selectedTableData = tables.find((table) => table.id === selectedTable);

  const selectedTableId =
    orderType === "local" && selectedTableData && isUuid(selectedTableData.id)
      ? selectedTableData.id
      : null;

  const selectedTableNumber =
    orderType === "local" && selectedTableData
      ? String(
          (selectedTableData as unknown as { number?: string | number })
            .number || selectedTableData.id,
        )
      : null;

  const canSubmit = () => {
    if (items.length === 0) return false;
    if (orderType === "local" && !selectedTable) return false;
    if (orderType === "local" && guestCount < 1) return false;

    if (orderType === "delivery") {
      if (!address.street || !address.number || !address.neighborhood) {
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;

    if (!restaurantId) {
      toast({
        title: "Restaurante não encontrado",
        description: "Não foi possível identificar o restaurante logado.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setIsPaymentModalOpen(false);

      const publicOrderNumber = Date.now().toString().slice(-6);

      const addressText =
        orderType === "delivery"
          ? `${address.street}, ${address.number}${
              address.complement ? ` - ${address.complement}` : ""
            } - ${address.neighborhood}${address.city ? `, ${address.city}` : ""}`
          : "";

      const orderNotes = [
        customer.observation ? `Obs: ${customer.observation}` : "",
        orderType === "local"
          ? `Pedido local | Mesa: ${
              selectedTableNumber || selectedTable || "não informada"
            } | Pessoas: ${guestCount}`
          : "",
        orderType === "delivery" ? `Endereço: ${addressText}` : "",
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
          payment_method: paymentMethod,
          payment_status: paymentMethod === "pending" ? "pending" : "paid",
          notes: orderNotes || null,
          table_id: selectedTableId,
          table_number: selectedTableNumber,
          guest_count: orderType === "local" ? guestCount : null,
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
        const { data: printJobResult, error: printJobError } = await supabase.rpc(
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
          throw new Error(result.error || "Erro ao criar job de impressão.");
        }
      } catch (printJobError) {
        printJobWarning =
          "Pedido criado, mas não foi possível enviar para a fila de impressão desktop.";

        console.error("Pedido manual criado, mas impressão desktop não foi gerada:", printJobError);
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

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Novo Pedido</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie um pedido manualmente para mesa, balcão ou delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  Tipo de Pedido
                </h2>

                <OrderTypeSelector value={orderType} onChange={setOrderType} />
              </div>

              {orderType === "local" && (
                <div className="space-y-4 rounded-xl border border-border bg-card p-5">
                  <TableSelector
                    tables={tables}
                    value={selectedTable}
                    onChange={setSelectedTable}
                    onCreateTable={handleCreateTable}
                    restaurantId={restaurantId}
                  />

                  <div className="rounded-xl border border-border bg-background p-4">
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Pessoas na mesa
                    </label>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setGuestCount((prev) => Math.max(1, prev - 1))
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-lg font-bold transition hover:bg-muted"
                      >
                        -
                      </button>

                      <input
                        type="number"
                        min={1}
                        value={guestCount}
                        onChange={(event) =>
                          setGuestCount(
                            Math.max(1, Number(event.target.value || 1)),
                          )
                        }
                        className="h-10 w-24 rounded-lg border border-input bg-background px-3 text-center text-sm font-bold"
                      />

                      <button
                        type="button"
                        onClick={() => setGuestCount((prev) => prev + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-lg font-bold transition hover:bg-muted"
                      >
                        +
                      </button>

                      <p className="text-xs text-muted-foreground">
                        Usado para calcular ticket médio por pessoa na comanda.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Dados do Cliente
                </h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Nome
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
                      placeholder="Nome do cliente"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
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
                      placeholder="(00) 00000-0000"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Observação do Pedido
                    </label>
                    <textarea
                      value={customer.observation || ""}
                      onChange={(event) =>
                        setCustomer({
                          ...customer,
                          observation: event.target.value,
                        })
                      }
                      placeholder="Observações gerais do pedido..."
                      rows={2}
                      className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {orderType === "delivery" && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Endereço de Entrega
                  </h2>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Rua <span className="text-destructive">*</span>
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
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Número <span className="text-destructive">*</span>
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
                        placeholder="123"
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
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
                        placeholder="Apto, bloco..."
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Bairro <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={address.neighborhood}
                        onChange={(event) =>
                          setAddress({
                            ...address,
                            neighborhood: event.target.value,
                          })
                        }
                        placeholder="Bairro"
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
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
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">
                  Adicionar Produtos
                </h2>

                <ProductSearch
                  products={products}
                  categories={categories}
                  onAddProduct={handleAddProduct}
                />
              </div>
            </div>

            <div className="xl:col-span-1">
              <div className="sticky top-6 flex h-[calc(100vh-100px)] flex-col rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">
                  Resumo do Pedido
                </h2>

                <div className="min-h-[320px] flex-1 overflow-hidden">
                  <OrderSummary
                    items={items}
                    orderType={orderType}
                    deliveryFee={deliveryFee}
                    discount={discount}
                    onUpdateQuantity={handleUpdateQuantity}
                    onUpdateObservation={handleUpdateObservation}
                    onRemoveItem={handleRemoveItem}
                    onDiscountChange={setDiscount}
                  />
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    disabled={!canSubmit() || isSubmitting}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-lg py-4 text-sm font-bold shadow-md transition-all",
                      canSubmit() && !isSubmitting
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
                        : "cursor-not-allowed bg-muted text-muted-foreground",
                    )}
                  >
                    Cobrar Pedido
                  </button>

                  {!canSubmit() && items.length > 0 && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      {orderType === "local" &&
                        !selectedTable &&
                        "Selecione uma mesa"}
                      {orderType === "local" &&
                        selectedTable &&
                        guestCount < 1 &&
                        "Informe a quantidade de pessoas"}
                      {orderType === "delivery" &&
                        (!address.street ||
                          !address.number ||
                          !address.neighborhood) &&
                        "Preencha o endereço completo"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-foreground">
                  Forma de Pagamento
                </h3>
                <p className="mt-1 text-muted-foreground">
                  Selecione como o cliente deseja pagar
                </p>
              </div>

              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-8 rounded-xl border border-border bg-accent/50 p-6 text-center">
              <span className="mb-1 block text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Total a Cobrar
              </span>

              <span className="text-4xl font-bold text-foreground">
                R$ {total.toFixed(2).replace(".", ",")}
              </span>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
              {paymentOptions.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 p-6 transition-all duration-200 ${
                    paymentMethod === method.id
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm"
                      : "border-border text-muted-foreground hover:border-border/80 hover:bg-accent"
                  }`}
                >
                  {method.icon}
                  <span className="font-semibold">{method.name}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-4 border-t border-border pt-6">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-xl px-6 py-3 font-semibold text-muted-foreground transition hover:bg-accent"
              >
                Cancelar
              </button>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-8 py-3 font-bold text-[hsl(var(--primary-foreground))] shadow-md transition hover:bg-[hsl(var(--primary))]/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Confirmar e Finalizar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
