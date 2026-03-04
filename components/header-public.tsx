"use client"

import Image from "next/image"
import Link from "next/link"

interface HeaderPublicProps {
  showBackLink?: boolean
  backHref?: string
  backLabel?: string
}

export default function HeaderPublic({
  showBackLink = false,
  backHref = "/",
  backLabel = "Voltar",
}: HeaderPublicProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-center border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="flex w-full max-w-7xl items-center justify-between px-4">
        {/* Back link (optional) */}
        {showBackLink ? (
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {backLabel}
          </Link>
        ) : (
          <div className="w-20" />
        )}

        {/* Centered Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="relative h-10 w-10 overflow-hidden rounded-xl">
            <Image
              src="/logo.jpg"
              alt="ClickFood"
              fill
              className="object-cover"
              priority
            />
          </div>
          <span className="text-xl font-bold text-gray-900">
            Click<span className="text-blue-600">Food</span>
          </span>
        </Link>

        {/* Right spacer or actions */}
        <div className="w-20" />
      </div>
    </header>
  )
}

// Simpler variant for auth pages - just logo centered
export function HeaderPublicSimple() {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="relative h-12 w-12 overflow-hidden rounded-xl shadow-lg shadow-blue-500/20">
          <Image
            src="/logo.jpg"
            alt="ClickFood"
            fill
            className="object-cover"
            priority
          />
        </div>
        <span className="text-2xl font-bold text-gray-900">
          Click<span className="text-blue-600">Food</span>
        </span>
      </Link>
    </div>
  )
}
