import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  memo,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DropdownOption } from '../../types/dropdown';

interface DropdownProps {
  options: DropdownOption[];
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxHeight?: string;
  renderOption?: (option: DropdownOption) => ReactNode;
  getDisplayValue?: (value: string) => string;
  allowClear?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  id?: string;
  searchable?: boolean;
  portal?: boolean;
}

const sizeClasses = {
  xs: 'px-1 py-1 text-sm',
  sm: 'px-2 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-6 py-4 text-lg',
};

const inputPaddingClasses = {
  xs: 'pl-2 pr-7',
  sm: 'pl-3 pr-8',
  md: 'pl-6 pr-10',
  lg: 'pl-6 pr-12',
};

const chevronRightClasses = {
  xs: 'right-2',
  sm: 'right-2',
  md: 'right-3',
  lg: 'right-4',
};

function Dropdown({
  options,
  placeholder = 'Select option',
  value,
  onChange,
  disabled = false,
  maxHeight = 'max-h-60',
  renderOption,
  getDisplayValue,
  allowClear = false,
  className = '',
  size = 'md',
  id,
  searchable = false,
  portal = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMeasured, setIsMeasured] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [panelAbove, setPanelAbove] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerWrapperRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  const usePortal = !searchable || portal;

  const selectedOption = options.find((o) => o.value === value);
  const resolvedDisplayLabel = useCallback(
    (val: string) =>
      getDisplayValue
        ? getDisplayValue(val)
        : options.find((o) => o.value === val)?.label || '',
    [getDisplayValue, options],
  );

  useEffect(() => {
    if (searchable && !isOpen) {
      setInputValue(value ? resolvedDisplayLabel(value) : '');
    }
  }, [value, searchable, isOpen, resolvedDisplayLabel]);

  const displayValue = getDisplayValue
    ? getDisplayValue(value || '')
    : selectedOption?.label || placeholder;

  const visibleOptions = useMemo(() => {
    if (!searchable || !isOpen) return options;
    const q = inputValue.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q),
    );
  }, [options, searchable, isOpen, inputValue]);

  const getTriggerEl = useCallback(
    () => (searchable ? triggerWrapperRef.current : buttonRef.current),
    [searchable],
  );

  const gap = searchable ? 0 : 4;

  const computePos = useCallback((el: HTMLElement, dd: HTMLElement | null) => {
    const rect = el.getBoundingClientRect();
    const vpHeight = window.visualViewport?.height ?? window.innerHeight;
    const spaceBelow = vpHeight - rect.bottom;
    const spaceAbove = rect.top;
    const ddHeight = dd ? dd.getBoundingClientRect().height : 0;
    const above = dd ? ddHeight > spaceBelow && spaceAbove > spaceBelow : false;
    const top = above ? rect.top - ddHeight - gap : rect.bottom + gap;
    return { top: Math.round(top), left: Math.floor(rect.left), width: Math.ceil(rect.width), above };
  }, [gap]);

  const updatePosition = useCallback(() => {
    const el = getTriggerEl();
    if (!el) return;
    const pos = computePos(el, dropdownRef.current);
    setPanelAbove(pos.above);
    setDropdownPosition((prev) =>
      prev.left === pos.left && prev.width === pos.width && prev.top === pos.top
        ? prev
        : pos,
    );
  }, [getTriggerEl, computePos]);

  const toggleOpen = () => {
    if (disabled) return;
    const next = !isOpen;
    setIsOpen(next);
    if (next) { setIsMeasured(false); if (usePortal) updatePosition(); }
    else { setIsMeasured(false); }
  };

  const handleInputFocus = () => {
    if (disabled) return;
    setInputValue('');
    setIsOpen(true);
    setIsMeasured(false);
    if (usePortal) updatePosition();
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) return;
    setInputValue(value ? resolvedDisplayLabel(value) : '');
    setIsOpen(false);
    setIsMeasured(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
      setIsMeasured(false);
      if (usePortal) updatePosition();
    }
  };

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    if (searchable) {
      setInputValue(optionValue ? resolvedDisplayLabel(optionValue) : '');
      inputRef.current?.blur();
    }
    setIsOpen(false);
    setIsMeasured(false);
  };

  useLayoutEffect(() => {
    if (!usePortal || !isOpen || isMeasured) return;
    const el = getTriggerEl();
    const dd = dropdownRef.current;

    const measure = (el2: HTMLElement, dd2: HTMLElement) => {
      const pos = computePos(el2, dd2);
      setDropdownPosition(pos);
      setPanelAbove(pos.above);
      setIsMeasured(true);
    };

    if (!el || !dd) {
      requestAnimationFrame(() => {
        const el2 = getTriggerEl();
        const dd2 = dropdownRef.current;
        if (el2 && dd2) measure(el2, dd2);
      });
      return;
    }
    measure(el, dd);
  }, [usePortal, isOpen, isMeasured, options.length, maxHeight, getTriggerEl, computePos]);

  // Close on any scroll outside the panel — applies to portal AND absolute dropdowns.
  // A 150 ms timeout lets the browser finish its automatic scroll-to-focused-input
  // before the listener is armed (a single rAF is not reliable across all browsers).
  useEffect(() => {
    if (!isOpen) return;

    const closeOnScroll = (e: Event) => {
      // Scrolls inside the panel list itself must not close it.
      if (dropdownRef.current?.contains(e.target as Node)) return;
      if (searchable) inputRef.current?.blur();
      setIsOpen(false);
      setIsMeasured(false);
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('scroll', closeOnScroll, true);
    }, 150);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [isOpen, searchable]);

  // Portal-only: reposition on window/viewport resize.
  useEffect(() => {
    if (!usePortal || !isOpen) return;
    window.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
    };
  }, [usePortal, isOpen, updatePosition]);

  useEffect(() => {
    if (!usePortal || !isOpen || !isMeasured) return;
    const raf = requestAnimationFrame(() => {
      const el = getTriggerEl();
      const dd = dropdownRef.current;
      if (!el || !dd) return;
      const pos = computePos(el, dd);
      setDropdownPosition(pos);
      setPanelAbove(pos.above);
    });
    return () => cancelAnimationFrame(raf);
  }, [usePortal, isOpen, isMeasured, options.length, maxHeight, getTriggerEl, computePos]);

  // Scroll selected item into view in the portal panel
  useLayoutEffect(() => {
    if (!usePortal || !isOpen || !isMeasured) return;
    const panel = dropdownRef.current;
    if (!panel || panel.scrollHeight <= panel.clientHeight + 1) return;
    const selectedEl = panel.querySelector<HTMLElement>('[data-dropdown-selected="true"]');
    if (!selectedEl) return;
    const panelRect = panel.getBoundingClientRect();
    const itemRect = selectedEl.getBoundingClientRect();
    const delta = (itemRect.top + itemRect.height / 2) - (panelRect.top + panel.clientHeight / 2);
    panel.scrollTop = Math.round(Math.max(0, Math.min(panel.scrollTop + delta, panel.scrollHeight - panel.clientHeight)));
  }, [usePortal, isOpen, isMeasured, value, options.length, maxHeight]);

  // Non-searchable: close on outside click
  useEffect(() => {
    if (searchable) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setIsMeasured(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, searchable]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (searchable) {
    // Shared option list used by both portal and absolute panels.
    const optionsList = (
      <div
        className={`${maxHeight} overflow-y-auto overscroll-contain py-2`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {allowClear && (
          <button
            type="button"
            className="w-full text-left px-4 py-2 hover:bg-blue-600 transition-colors rounded-2xl text-gray-400 text-sm"
            style={{ width: 'calc(100% - 1rem)', marginLeft: '0.5rem' }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleOptionClick('')}
          >
            Clear selection
          </button>
        )}
        {visibleOptions.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-500 text-center">No options found</div>
        ) : (
          visibleOptions.map((option) => {
            const isSelected = option.selected || option.value === value;
            return (
              <button
                type="button"
                key={option.value}
                data-dropdown-selected={isSelected ? true : undefined}
                onMouseDown={(e) => e.preventDefault()}
                className={`w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors rounded-2xl text-sm ${
                  isSelected ? 'text-white font-medium' : 'text-gray-300'
                }`}
                style={{ width: 'calc(100% - 1rem)', marginLeft: '0.5rem' }}
                onClick={() => handleOptionClick(option.value)}
              >
                {renderOption ? renderOption(option) : option.label}
              </button>
            );
          })
        )}
      </div>
    );

    const divider = <div className="border-t border-blue-600/50 mx-4" />;

    // Portal panel — flush with the trigger edge, matching the absolute-panel connected style.
    // border-t-0 / border-b-0 removes the joining edge so there's no double-border at the junction.
    const portalPanel = isOpen && (
      <div
        ref={dropdownRef}
        className={`fixed bg-gray-800 border-2 border-blue-600 shadow-2xl ${
          panelAbove
            ? 'rounded-t-3xl rounded-b-none border-b-0'
            : 'rounded-b-3xl rounded-t-none border-t-0'
        }`}
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`,
          zIndex: 10000,
          visibility: isMeasured ? 'visible' : 'hidden',
        }}
      >
        {panelAbove ? <>{optionsList}{divider}</> : <>{divider}{optionsList}</>}
      </div>
    );

    // Absolute panel — original in-flow connected style (always below).
    // border-t-0 removes the top border so there's no gap; no negative margin needed
    // because the absolute panel doesn't rely on getBoundingClientRect() measurements.
    const absolutePanel = isOpen && (
      <div
        ref={dropdownRef}
        className="absolute z-50 w-full bg-gray-800 border-2 border-blue-600 border-t-0 rounded-b-3xl shadow-2xl"
      >
        {divider}
        {optionsList}
      </div>
    );

    // Trigger open state: square off the joining edge and use border-transparent (not border-0)
    // to keep the element height stable for getBoundingClientRect measurement.
    // Non-portal: border-b-0 is fine (no measurement needed — panel is in-flow).
    const triggerOpenClass = !portal
      ? 'rounded-t-3xl rounded-b-none border-b-0'
      : panelAbove
        ? 'rounded-b-3xl rounded-t-none border-t-transparent'
        : 'rounded-t-3xl rounded-b-none border-b-transparent';

    return (
      <div className="relative">
        <div
          ref={triggerWrapperRef}
          className={`relative bg-gray-800 border-2 transition-[border-radius] duration-75 border-blue-600 ${
            isOpen ? triggerOpenClass : 'rounded-full'
          } ${disabled ? 'opacity-70' : ''} ${className}`}
        >
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={inputValue}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onChange={handleInputChange}
            className={`w-full bg-transparent text-white font-semibold focus:outline-none placeholder:text-gray-400 ${inputPaddingClasses[size]} ${sizeClasses[size]} ${
              disabled ? 'cursor-not-allowed' : 'cursor-text'
            }`}
          />
          <ChevronDown
            className={`pointer-events-none absolute ${chevronRightClasses[size]} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 transition-transform duration-300 ${
              isOpen && !panelAbove ? 'rotate-180' : ''
            }`}
          />
        </div>
        {portal ? createPortal(portalPanel, document.body) : absolutePanel}
      </div>
    );
  }

  // ── Non-searchable (always portal) ─────────────────────────────────────────
  const dropdownContent = isOpen && (
    <div
      ref={dropdownRef}
      className={`fixed bg-gray-800 border-2 border-blue-600 rounded-2xl shadow-lg py-1 ${maxHeight} overflow-y-auto overscroll-contain px-1`}
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        zIndex: 10000,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        visibility: isMeasured ? 'visible' : 'hidden',
      }}
    >
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
      {allowClear && (
        <button
          type="button"
          className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700 text-gray-400"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleOptionClick('')}
        >
          Clear selection
        </button>
      )}
      {visibleOptions.length === 0 ? (
        <div className="px-3 py-3 text-sm text-gray-500 text-center">No options found</div>
      ) : (
        visibleOptions.map((option) => {
          const isSelected = option.selected || option.value === value;
          return (
            <button
              type="button"
              key={option.value}
              data-dropdown-selected={isSelected ? true : undefined}
              onMouseDown={(e) => e.preventDefault()}
              className={`block w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-blue-600 hover:text-white ${
                isSelected ? 'text-white font-medium' : 'text-gray-300'
              }`}
              onClick={() => handleOptionClick(option.value)}
            >
              {renderOption ? renderOption(option) : option.label}
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          id={id}
          type="button"
          onClick={toggleOpen}
          disabled={disabled}
          className={`flex items-center justify-between w-full bg-gray-800 border-2 border-blue-600 rounded-full text-left
            ${disabled ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-650'} ${sizeClasses[size]} ${className}`}
        >
          <span className="truncate ml-2 font-semibold">{displayValue}</span>
          <span
            className="transition-transform duration-200 ml-2 shrink-0"
            style={{ display: 'flex', alignItems: 'center', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </span>
        </button>
      </div>
      {isOpen && createPortal(dropdownContent, document.body)}
    </>
  );
}

export default memo(Dropdown);
