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
    <div className={`border-b px-6 pt-6 ${isPharmacy ? 'border-[#E5E7EB]' : 'border-slate-200'}`}>
      <div className="flex flex-wrap gap-1 sm:gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as T)}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-all ${
              activeTab === tab.id
                ? isPharmacy
                  ? 'bg-white border-t border-l border-r border-[#E5E7EB] -mb-px text-[#2563EB]'
                  : 'bg-white border-t border-l border-r border-slate-300 text-blue-600 -mb-px'
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

