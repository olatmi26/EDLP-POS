import superMarketImg from '../../../assets/super-market2.jpg'

export function AuthSplitShell({ children }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--edlp-navy)]">
      <div className="flex h-full w-full flex-col overflow-hidden bg-gradient-to-b from-[#101827] to-[var(--edlp-navy)]">
        {children}
      </div>
    </div>
  )
}

export function AuthHeroPanel() {
  return (
    <div className="relative hidden h-full min-h-0 md:block">
      <img
        src={superMarketImg}
        alt="Supermarket display"
        className="absolute inset-0 h-full w-full object-cover object-left-bottom"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,29,49,0.78),rgba(19,29,49,0.58))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(232,160,32,0.24),transparent_56%)]" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="px-8 text-center">
          <div className="text-4xl font-bold leading-tight text-white">
            Welcome to <span className="text-[var(--edlp-primary)]">Smarter Retail</span>
          </div>
          <div className="mt-3 text-base text-white/85">
            Your unified platform for all EDLP branches.
          </div>
        </div>
      </div>
    </div>
  )
}

