"use client"

import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Eye,
  LayoutGrid,
  Power,
  PowerOff,
  Percent,
  FolderOpen,
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
import type { Category, SortOption, ViewMode } from "@/lib/products-data"

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
  onBatchActivate: () => void
  onBatchDeactivate: () => void
  onBatchCategoryChange: (categoryId: string) => void
  onBatchPriceAdjust: (percent: number) => void
}

const sortLabels: Record<SortOption, string> = {
  name: "Nome",
  price: "Preco",
  profit: "Lucro",
}

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
  onBatchActivate,
  onBatchDeactivate,
  onBatchCategoryChange,
  onBatchPriceAdjust,
}: ProductsToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Search + Filters + Sort + View toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>

        {/* Category filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-secondary">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">
                {categoryFilter === "all" ? "Todas categorias" : categories.find((c) => c.id === categoryFilter)?.name}
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
            {categories.map((cat) => (
              <DropdownMenuItem
                key={cat.id}
                onClick={() => onCategoryFilterChange(cat.id)}
                className={cn("cursor-pointer", categoryFilter === cat.id && "font-semibold text-[hsl(var(--primary))]")}
              >
                {cat.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-secondary">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(sortLabels) as SortOption[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => onSortChange(key)}
                className={cn("cursor-pointer", sortBy === key && "font-semibold text-[hsl(var(--primary))]")}
              >
                {sortLabels[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View mode toggle */}
        <div className="ml-auto flex items-center rounded-lg border border-input bg-background p-0.5">
          <button
            onClick={() => onViewModeChange("management")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
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
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
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

      {/* Row 2: Batch actions (only shown when items selected) */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} {selectedCount === 1 ? "produto selecionado" : "produtos selecionados"}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={onBatchActivate}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
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

            {/* Change category */}
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
                {categories.map((cat) => (
                  <DropdownMenuItem
                    key={cat.id}
                    onClick={() => onBatchCategoryChange(cat.id)}
                    className="cursor-pointer"
                  >
                    {cat.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Price adjustment */}
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
                {[5, 10, 15, 20, -5, -10, -15].map((pct) => (
                  <DropdownMenuItem
                    key={pct}
                    onClick={() => onBatchPriceAdjust(pct)}
                    className={cn("cursor-pointer", pct < 0 && "text-destructive")}
                  >
                    {pct > 0 ? `+${pct}%` : `${pct}%`}
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
