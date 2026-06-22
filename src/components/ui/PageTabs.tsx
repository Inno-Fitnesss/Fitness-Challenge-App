interface Tab {
  id: string;
  label: string;
}

interface PageTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function PageTabs({ tabs, activeTab, onChange, className = '' }: PageTabsProps) {
  return (
    <div role="tablist" className={`flex gap-8 border-b border-neutral-border ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`
              pb-3 text-sm font-semibold transition-colors relative
              ${isActive ? 'text-brand' : 'text-neutral-muted hover:text-neutral-secondary'}
            `}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
