import { LucideIcon } from "lucide-react"

type ComingSoonPageProps = {
  title: string
  description: string
  icon: LucideIcon
  badge?: string
}

export default function ComingSoonPage({
  title,
  description,
  icon: Icon,
  badge = "Em construção",
}: ComingSoonPageProps) {
  return (
    <div className="min-h-[calc(100vh-96px)] bg-[#111111] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2rem] border border-white/10 bg-[#0A0A0A] p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-black shadow-lg shadow-yellow-400/20">
                <Icon className="h-7 w-7" />
              </div>

              <div>
                <div className="mb-2 inline-flex rounded-full bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-400">
                  {badge}
                </div>

                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {title}
                </h1>

                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-500">
                  {description}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-dashed border-white/10 bg-[#111111] p-6">
            <p className="text-sm font-semibold text-zinc-500">
              Essa área já está reservada na nova estrutura da ClickFood. Agora vamos conectar banco,
              regras de negócio e interface sem bagunçar o projeto.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}