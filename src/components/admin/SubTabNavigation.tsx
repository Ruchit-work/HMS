interface SubTab {
  id: string
  label: string
}

interface SubTabNavigationProps<T extends string = string> {
  tabs: SubTab[]
  activeTab: T
  onTabChange: (tabId: T) => void
  variant?: 'default' | 'pharmacy'
}

export default function SubTabNavigation<T extends string = string>({ tabs, activeTab, onTabChange, variant = 'default' }: SubTabNavigationProps<T>) {
  const isPharmacy = variant === 'pharmacy'
  return (
    <div className={`border-b px-6 pt-6 ${isPharmacy ? 'border-[var(--color-neutral-200)]' : 'border-slate-200'}`}>
      <div className="flex gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:gap-4 sm:overflow-visible sm:pb-0 [-webkit-overflow-scrolling:touch]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as T)}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-all ${
              activeTab === tab.id
                ? isPharmacy
                  ? 'bg-white border-t border-l border-r border-[var(--color-neutral-200)] -mb-px text-[var(--color-primary)]'
                  : 'bg-white border-t border-l border-r border-slate-300 text-[var(--color-primary-dark)] -mb-px'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

