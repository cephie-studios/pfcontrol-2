import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  memo,
  useMemo,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
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

const OPTION_SELECTOR = '[data-dropdown-option]';

const isFocusLost = () =>
  !document.activeElement || document.activeElement === document.body;

function revealInList(el: HTMLElement) {
  const list = el.closest<HTMLElement>('[data-dropdown-scroll]');
  if (!list) return;
  const listRect = list.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  if (rect.top < listRect.top) list.scrollTop -= listRect.top - rect.top;
  else if (rect.bottom > listRect.bottom)
    list.scrollTop += rect.bottom - listRect.bottom;
}

function handlePanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const items = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(OPTION_SELECTOR)
  );
  if (items.length === 0) return;
  e.preventDefault();
  const idx = items.indexOf(document.activeElement as HTMLElement);
  const last = items.length - 1;
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? last
        : e.key === 'ArrowDown'
          ? idx < 0
            ? 0
            : Math.min(idx + 1, last)
          : idx < 0
            ? last
            : Math.max(idx - 1, 0);
  items[next].focus({ preventScroll: true });
  revealInList(items[next]);
}

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
  const [panelAbove, setPanelAbove] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerWrapperRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const listId = useId();

  const selectedOption = options.find((o) => o.value === value);
  const resolvedDisplayLabel = useCallback(
    (val: string) =>
      getDisplayValue
        ? getDisplayValue(val)
        : options.find((o) => o.value === val)?.label || '',
    [getDisplayValue, options]
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
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, searchable, isOpen, inputValue]);

  const trackSide = searchable && portal;
  const setPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      dropdownRef.current = node;
      if (!node || !trackSide) return;
      const sync = () =>
        setPanelAbove(node.getAttribute('data-side') === 'top');
      sync();
      const observer = new MutationObserver(sync);
      observer.observe(node, {
        attributes: true,
        attributeFilter: ['data-side'],
      });
      return () => {
        observer.disconnect();
        dropdownRef.current = null;
        setPanelAbove(false);
      };
    },
    [trackSide]
  );

  const openFromInput = () => {
    if (disabled) return;
    setInputValue('');
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    openFromInput();
  };

  const handleInputClick = () => {
    if (!isOpen) openFromInput();
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) return;
    setInputValue(value ? resolvedDisplayLabel(value) : '');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    if (searchable) {
      setInputValue(optionValue ? resolvedDisplayLabel(optionValue) : '');
      inputRef.current?.blur();
    }
    setIsOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && !isOpen) {
      e.preventDefault();
      openFromInput();
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (visibleOptions.length > 0) {
      handleOptionClick(visibleOptions[0].value);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const closeOnScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      if (searchable) inputRef.current?.blur();
      setIsOpen(false);
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('scroll', closeOnScroll, true);
    }, 150);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [isOpen, searchable]);

  if (searchable) {
    const handleOpenChange = (open: boolean) => {
      if (open) return;
      setInputValue(value ? resolvedDisplayLabel(value) : '');
      setIsOpen(false);
    };

    const isInTrigger = (target: EventTarget | null) =>
      !!triggerWrapperRef.current?.contains(target as Node);

    const optionsList = isOpen && (
      <div
        data-dropdown-scroll
        className={`no-scrollbar ${maxHeight} overflow-y-auto overscroll-contain py-1`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {allowClear && (
          <button
            type="button"
            role="option"
            aria-selected={false}
            data-dropdown-option
            className="w-full text-left px-4 py-2 hover:bg-blue-600 transition-colors rounded-2xl text-gray-400 text-sm"
            style={{ width: 'calc(100% - 0.5rem)', marginLeft: '0.25rem' }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleOptionClick('')}
          >
            Clear selection
          </button>
        )}
        {visibleOptions.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-500 text-center">
            No options found
          </div>
        ) : (
          visibleOptions.map((option) => {
            const isSelected = option.selected || option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                key={option.value}
                data-dropdown-option
                data-dropdown-selected={isSelected ? true : undefined}
                onMouseDown={(e) => e.preventDefault()}
                className={`w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors rounded-2xl text-sm ${
                  isSelected ? 'text-white font-medium' : 'text-gray-300'
                }`}
                style={{ width: 'calc(100% - 0.5rem)', marginLeft: '0.25rem' }}
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

    const panel = isOpen && (
      <PopoverPrimitive.Content
        ref={setPanelRef}
        id={listId}
        role="listbox"
        side="bottom"
        align="start"
        sideOffset={0}
        avoidCollisions={portal}
        updatePositionStrategy={portal ? 'always' : 'optimized'}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (isInTrigger(e.target)) e.preventDefault();
        }}
        onKeyDown={handlePanelKeyDown}
        className={
          portal
            ? `bg-gray-800 border-2 border-blue-600 shadow-2xl outline-none ${
                panelAbove
                  ? 'rounded-t-[22px] rounded-b-none border-b-0'
                  : 'rounded-b-[22px] rounded-t-none border-t-0'
              }`
            : 'z-50 bg-gray-800 border-2 border-blue-600 border-t-0 rounded-b-[22px] shadow-2xl outline-none'
        }
        style={{
          width: 'var(--radix-popover-trigger-width)',
          ...(portal ? { zIndex: 10000 } : null),
        }}
      >
        {portal && panelAbove ? (
          <>
            {optionsList}
            {divider}
          </>
        ) : (
          <>
            {divider}
            {optionsList}
          </>
        )}
      </PopoverPrimitive.Content>
    );

    const triggerOpenClass = !portal
      ? 'rounded-t-[22px] rounded-b-none border-b-0'
      : panelAbove
        ? 'rounded-b-[22px] rounded-t-none border-t-transparent'
        : 'rounded-t-[22px] rounded-b-none border-b-transparent';

    const trigger = (
      <div
        ref={triggerWrapperRef}
        className={`relative bg-gray-800 border-2 border-blue-600 ${
          isOpen ? triggerOpenClass : 'rounded-full'
        } ${disabled ? 'opacity-60' : ''} ${className}`}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          aria-autocomplete="list"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          onFocus={handleInputFocus}
          onClick={handleInputClick}
          onBlur={handleInputBlur}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
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
    );

    return (
      <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
        {portal ? (
          <div className="relative">
            <PopoverPrimitive.Anchor asChild>{trigger}</PopoverPrimitive.Anchor>
            {panel && (
              <PopoverPrimitive.Portal>{panel}</PopoverPrimitive.Portal>
            )}
          </div>
        ) : (
          <PopoverPrimitive.Anchor asChild>
            <div className="relative">
              {trigger}
              {panel}
            </div>
          </PopoverPrimitive.Anchor>
        )}
      </PopoverPrimitive.Root>
    );
  }

  const dropdownContent = isOpen && (
    <PopoverPrimitive.Content
      ref={setPanelRef}
      role="listbox"
      side="bottom"
      align="start"
      sideOffset={4}
      data-dropdown-scroll
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        const panel = dropdownRef.current;
        if (!panel) return;
        const selectedEl = panel.querySelector<HTMLElement>(
          '[data-dropdown-selected="true"]'
        );
        if (selectedEl && panel.scrollHeight > panel.clientHeight + 1) {
          const panelRect = panel.getBoundingClientRect();
          const itemRect = selectedEl.getBoundingClientRect();
          const delta =
            itemRect.top +
            itemRect.height / 2 -
            (panelRect.top + panel.clientHeight / 2);
          panel.scrollTop = Math.round(
            Math.max(
              0,
              Math.min(
                panel.scrollTop + delta,
                panel.scrollHeight - panel.clientHeight
              )
            )
          );
        }
        (
          selectedEl ?? panel.querySelector<HTMLElement>(OPTION_SELECTOR)
        )?.focus({ preventScroll: true });
      }}
      onCloseAutoFocus={(e) => {
        e.preventDefault();
        if (isFocusLost()) buttonRef.current?.focus({ preventScroll: true });
      }}
      onKeyDown={handlePanelKeyDown}
      className={`no-scrollbar bg-gray-800 border-2 border-blue-600 rounded-[22px] shadow-lg p-1 ${maxHeight} overflow-y-auto overscroll-contain outline-none`}
      style={{
        width: 'var(--radix-popover-trigger-width)',
        zIndex: 10000,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {allowClear && (
        <button
          type="button"
          role="option"
          aria-selected={false}
          data-dropdown-option
          className="block w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-gray-700 focus-visible:bg-gray-700 focus-visible:outline-none text-gray-400"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleOptionClick('')}
        >
          Clear selection
        </button>
      )}
      {visibleOptions.length === 0 ? (
        <div className="px-3 py-3 text-sm text-gray-500 text-center">
          No options found
        </div>
      ) : (
        visibleOptions.map((option) => {
          const isSelected = option.selected || option.value === value;
          return (
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              key={option.value}
              data-dropdown-option
              data-dropdown-selected={isSelected ? true : undefined}
              onMouseDown={(e) => e.preventDefault()}
              className={`block w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-blue-600 hover:text-white focus-visible:bg-blue-600 focus-visible:text-white focus-visible:outline-none ${
                isSelected ? 'text-white font-medium' : 'text-gray-300'
              }`}
              onClick={() => handleOptionClick(option.value)}
            >
              {renderOption ? renderOption(option) : option.label}
            </button>
          );
        })
      )}
    </PopoverPrimitive.Content>
  );

  return (
    <PopoverPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (open && disabled) return;
        setIsOpen(open);
      }}
    >
      <div className="relative">
        <PopoverPrimitive.Trigger asChild>
          <button
            ref={buttonRef}
            id={id}
            type="button"
            aria-haspopup="listbox"
            onKeyDown={(e) => {
              if (isOpen || disabled) return;
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setIsOpen(true);
              }
            }}
            disabled={disabled}
            className={`flex items-center justify-between w-full bg-gray-800 border-2 border-blue-600 rounded-full text-left
            ${disabled ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-650'} ${sizeClasses[size]} ${className}`}
          >
            <span className="truncate ml-2 font-semibold">{displayValue}</span>
            <span
              className="transition-transform duration-200 ml-2 shrink-0"
              style={{
                display: 'flex',
                alignItems: 'center',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </span>
          </button>
        </PopoverPrimitive.Trigger>
      </div>
      {dropdownContent && (
        <PopoverPrimitive.Portal>{dropdownContent}</PopoverPrimitive.Portal>
      )}
    </PopoverPrimitive.Root>
  );
}

export default memo(Dropdown);
