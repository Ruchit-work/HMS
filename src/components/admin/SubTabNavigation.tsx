interface SubTab {
  id: string
  label: string
}

interface SubTabNavigationProps<T extends string = string> {
  tabs: SubTab[]
  activeTab: T
  onTabChange: (tabId: T) => void
}

export default function SubTabNavigation<T extends string = string>({ tabs, activeTab, onTabChange }: SubTabNavigationProps<T>) {
  return (
    <div className="border-b border-slate-200 px-6 pt-6">
      <div className="flex gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as T)}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-all ${
              activeTab === tab.id
                ? "bg-white border-t border-l border-r border-slate-300 text-blue-600 -mb-px"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

