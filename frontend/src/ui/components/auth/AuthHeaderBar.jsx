import { Search, UserRound, UsersRound, Menu } from 'lucide-react'

export function AuthHeaderBar() {
  return (
    <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-3 text-white">
        <span className="text-[var(--edlp-primary)]">🛒</span>
        <span className="text-lg font-bold tracking-wide">EDLP Nig Ltd</span>
      </div>

      <div className="flex items-center gap-4 text-white/75">
        <button type="button" className="hover:text-[var(--edlp-primary)]" aria-label="Search">
          <Search size={18} />
        </button>
        <button type="button" className="hover:text-[var(--edlp-primary)]" aria-label="Profile">
          <UserRound size={18} />
        </button>
        <button type="button" className="hover:text-[var(--edlp-primary)]" aria-label="Users">
          <UsersRound size={18} />
        </button>
        <button type="button" className="hover:text-[var(--edlp-primary)]" aria-label="Menu">
          <Menu size={18} />
        </button>
      </div>
    </div>
  )
}

