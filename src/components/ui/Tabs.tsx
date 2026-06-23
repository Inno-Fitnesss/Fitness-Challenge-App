interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Вкладки авторизации"
      className={`flex p-1.5 bg-neutral-card rounded-2xl border border-neutral-border ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`
              flex-1 py-2.5 px-3 text-sm font-semibold rounded-xl
              transition-all duration-200
              ${isActive
                ? 'bg-lime-pale text-brand shadow-sm'
                : 'text-neutral-secondary hover:text-neutral-text hover:bg-white/50'
              }
            `}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
