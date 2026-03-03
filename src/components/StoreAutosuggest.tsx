import { useState, useEffect, useRef } from "react";
import { getAllStoreNames } from "../services/expenseService";

interface StoreAutosuggestProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function StoreAutosuggest({
  id,
  value,
  onChange,
  placeholder = 'e.g. "Home Depot"',
}: StoreAutosuggestProps) {
  const [stores, setStores] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getAllStoreNames().then(setStores);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = value.trim()
    ? stores.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase()),
      )
    : stores;

  const handleSelect = (store: string) => {
    onChange(store);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25"
        autoComplete="off"
      />
      {showSuggestions && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border-strong bg-surface-elevated shadow-lg">
          {filtered.map((store) => (
            <li key={store}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(store)}
                className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface"
              >
                {store}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
