import React, { useMemo } from 'react';
import {
  Search,
  X,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Layers,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';
import { ENGINE_COMPONENTS, COMPONENT_CATEGORIES } from '../../data/engineComponents';
import { ComponentCategory } from '../../types/engine';

export const ComponentExplorer: React.FC = () => {
  const {
    selectedComponentId,
    setSelectedComponentId,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    hiddenComponentIds,
    toggleComponentVisibility,
    isolatedComponentId,
    isolateComponent
  } = useEngineStore();

  const filteredComponents = useMemo(() => {
    return ENGINE_COMPONENTS.filter((comp) => {
      // Category filter
      if (selectedCategory !== 'all' && comp.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          comp.displayName.toLowerCase().includes(q) ||
          comp.id.toLowerCase().includes(q) ||
          comp.subsystem.toLowerCase().includes(q) ||
          comp.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <aside className="w-80 h-full bg-white border-r border-slate-200/80 flex flex-col shadow-xs flex-shrink-0 z-10">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/50 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" />
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-800">
              Component Explorer
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500 font-semibold">
            {filteredComponents.length} Parts
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search parts, functions, materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white pl-8 pr-7 py-1.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder:text-slate-400 font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Dropdown */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full text-xs py-1 px-2 rounded border border-slate-300 bg-white text-slate-700 font-sans focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {COMPONENT_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Component Tree List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredComponents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-sans">
            No components match your search.
          </div>
        ) : (
          filteredComponents.map((comp) => {
            const isSelected = selectedComponentId === comp.id;
            const isHidden = hiddenComponentIds.has(comp.id);
            const isIsolated = isolatedComponentId === comp.id;

            return (
              <div
                key={comp.id}
                onClick={() => setSelectedComponentId(comp.id)}
                className={`p-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                  isSelected
                    ? 'bg-sky-50/80 text-sky-950 border-l-4 border-sky-600 font-semibold'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{comp.displayName}</span>
                    {isIsolated && (
                      <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                        ISOLATED
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                    {comp.subsystem}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Eye Visibility Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleComponentVisibility(comp.id);
                    }}
                    className={`p-1 rounded hover:bg-slate-200/60 cursor-pointer transition-colors ${
                      isHidden ? 'text-slate-300' : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title={isHidden ? 'Show Component' : 'Hide Component'}
                  >
                    {isHidden ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-slate-200 bg-slate-50/60 text-[11px] text-slate-500 font-mono flex items-center justify-between">
        <span>Total: 22 Components</span>
        {isolatedComponentId && (
          <button
            onClick={() => isolateComponent(null)}
            className="text-rose-600 hover:underline font-bold cursor-pointer"
          >
            Clear Isolation
          </button>
        )}
      </div>
    </aside>
  );
};
