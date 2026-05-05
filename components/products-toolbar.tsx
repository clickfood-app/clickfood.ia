"use client"

import {
  ArrowUpDown,
  Eye,
  FolderOpen,
  LayoutGrid,
  Percent,
  Power,
  PowerOff,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type {
  Category,
  ProductQuickFilter,
  SortOption,
  ViewMode,
} from "@/lib/products-data"

interface ProductsToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryFilterChange: (value: string) => void
  categories: Category[]
  sortBy: SortOption
  onSortChange: (value: SortOption) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  selectedCount: number
  visibleCount: number
  quickFilters: Set<ProductQuickFilter>
  quickFilterCounts: Record<ProductQuickFilter, number>
  onToggleQuickFilter: (value: ProductQuickFilter) => void
  onClearQuickFilters: () => void
  onBatchActivate: () => void
  onBatchDeactivate: () => void
  onBatchCategoryChange: (categoryId: string) => void
  onBatchPriceAdjust: (percent: number) => void
}

const sortLabels: Record<SortOption, string> = {
  manual: "Ordem manual",
  name: "A-Z",
  price: "Maior preco",
  profit: "Maior lucro",
}

const quickFilterLabels: Record<ProductQuickFilter, string> = {
  "low-margin": "Margem baixa",
  "low-sales": "Baixa saida",
  "no-image": "Sem foto",
  "no-cost": "Sem custo",
}

const quickFilterOrder: ProductQuickFilter[] = [
  "low-margin",
  "low-sales",
  "no-image",
  "no-cost",
]

export default function ProductsToolbar({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  selectedCount,
  visibleCount,
  quickFilters,
  quickFilterCounts,
  onToggleQuickFilter,
  onClearQuickFilters,
  onBatchActivate,
  onBatchDeactivate,
  onBatchCategoryChange,
  onBatchPriceAdjust,
}: ProductsToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou descricao..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-10 items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-secondary">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">
                {categoryFilter === "all"
                  ? "Todas categorias"
                  : categories.find((category) => category.id === categoryFilter)?.name}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filtrar por categoria</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onCategoryFilterChange("all")}
              className={cn("cursor-pointer", categoryFilter === "all" && "font-semibold text-[hsl(var(--primary))]")}
            >
              Todas categorias
            </DropdownMenuItem>
            {categories.map((category) => (
              <DropdownMenuItem
                key={category.id}
                onClick={() => onCategoryFilterChange(category.id)}
                className={cn(
                  "cursor-pointer",
                  categoryFilter === category.id && "font-semibold text-[hsl(var(--primary))]"
                )}
              >
                {category.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-10 items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-secondary">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(sortLabels) as SortOption[]).map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => onSortChange(option)}
                className={cn("cursor-pointer", sortBy === option && "font-semibold text-[hsl(var(--primary))]")}
              >
                {sortLabels[option]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center rounded-xl border border-input bg-background p-0.5">
          <button
            onClick={() => onViewModeChange("management")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "management"
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Gestao</span>
          </button>
          <button
            onClick={() => onViewModeChange("menu")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "menu"
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cardapio</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {visibleCount} resultado{visibleCount === 1 ? "" : "s"}
        </span>

        {quickFilterOrder.map((filter) => {
          const active = quickFilters.has(filter)
          const count = quickFilterCounts[filter]

          return (
            <button
              key={filter}
              onClick={() => onToggleQuickFilter(filter)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {quickFilterLabels[filter]}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "bg-secondary"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}

        {quickFilters.size > 0 && (
          <button
            onClick={onClearQuickFilters}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Limpar alertas
          </button>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} {selectedCount === 1 ? "produto selecionado" : "produtos selecionados"}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              onClick={onBatchActivate}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <Power className="h-3.5 w-3.5" />
              Ativar
            </button>

            <button
              onClick={onBatchDeactivate}
              className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
            >
              <PowerOff className="h-3.5 w-3.5" />
              Desativar
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Categoria
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categories.map((category) => (
                  <DropdownMenuItem
                    key={category.id}
                    onClick={() => onBatchCategoryChange(category.id)}
                    className="cursor-pointer"
                  >
                    {category.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary">
                  <Percent className="h-3.5 w-3.5" />
                  Reajuste
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Reajuste de preco</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[5, 10, 15, 20, -5, -10, -15].map((percentage) => (
                  <DropdownMenuItem
                    key={percentage}
                    onClick={() => onBatchPriceAdjust(percentage)}
                    className={cn("cursor-pointer", percentage < 0 && "text-destructive")}
                  >
                    {percentage > 0 ? `+${percentage}%` : `${percentage}%`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </div>
  )
}
