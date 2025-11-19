import { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
}

const sizeClasses = {
  xs: 'px-1 py-1 text-sm',
  sm: 'px-2 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-6 py-4 text-lg',
};

export default function Dropdown({
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
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMeasured, setIsMeasured] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  const displayValue = getDisplayValue
    ? getDisplayValue(value || '')
    : selectedOption?.label || placeholder;

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setIsMeasured(false);
  };

  const updatePositionFromButton = () => {
    const btn = buttonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDropdownPosition((prev) => ({
        ...prev,
        left: rect.left,
        width: rect.width,
      }));
    }
  };

  const toggleOpen = () => {
    if (disabled) return;
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      setIsMeasured(false);
      updatePositionFromButton();
    } else {
      setIsMeasured(false);
    }
  };

  useLayoutEffect(() => {
    if (!isOpen || isMeasured) return;
    const btn = buttonRef.current;
    const dd = dropdownRef.current;

    if (!btn || !dd) {
      requestAnimationFrame(() => {
        const btn2 = buttonRef.current;
        const dd2 = dropdownRef.current;
        if (!btn2 || !dd2) return;
        const btnRect = btn2.getBoundingClientRect();
        const ddRect = dd2.getBoundingClientRect();
        const spaceBelow = window.innerHeight - btnRect.bottom;
        const spaceAbove = btnRect.top;

        const top =
          ddRect.height > spaceBelow && spaceAbove > spaceBelow
            ? btnRect.top - ddRect.height - 4
            : btnRect.bottom + 4;

        setDropdownPosition({
          top,
          left: btnRect.left,
          width: btnRect.width,
        });
        setIsMeasured(true);
      });
      return;
    }

    const btnRect = btn.getBoundingClientRect();
    const ddRect = dd.getBoundingClientRect();
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const spaceAbove = btnRect.top;

    const top =
      ddRect.height > spaceBelow && spaceAbove > spaceBelow
        ? btnRect.top - ddRect.height - 4
        : btnRect.bottom + 4;

    setDropdownPosition({
      top,
      left: btnRect.left,
      width: btnRect.width,
    });

    setIsMeasured(true);
  }, [isOpen, isMeasured, options.length, maxHeight]);

  useEffect(() => {
    if (!isOpen) return;

    let lastScrollTop = window.scrollY;
    let lastScrollLeft = window.scrollX;
    let lastBtnRect: DOMRect | null = null;
    let rafId = 0;

    const handlePositionUpdate = () => {
      const currentScrollTop = window.scrollY;
      const currentScrollLeft = window.scrollX;
      const btnRect = buttonRef.current?.getBoundingClientRect() ?? null;

      const btnChanged =
        !lastBtnRect ||
        (btnRect &&
          (btnRect.top !== lastBtnRect.top ||
            btnRect.left !== lastBtnRect.left ||
            btnRect.width !== lastBtnRect.width ||
            btnRect.height !== lastBtnRect.height));

      if (
        currentScrollTop !== lastScrollTop ||
        currentScrollLeft !== lastScrollLeft ||
        btnChanged
      ) {
        updatePositionFromButton();
        lastScrollTop = currentScrollTop;
        lastScrollLeft = currentScrollLeft;
        lastBtnRect = btnRect;
      }

      rafId = requestAnimationFrame(handlePositionUpdate);
    };

    rafId = requestAnimationFrame(handlePositionUpdate);

    window.addEventListener('resize', updatePositionFromButton);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePositionFromButton);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMeasured) return;

    const adjustPosition = () => {
      const btn = buttonRef.current;
      const dd = dropdownRef.current;
      if (!btn || !dd) return;

      const btnRect = btn.getBoundingClientRect();
      const ddRect = dd.getBoundingClientRect();

      const spaceBelow = window.innerHeight - btnRect.bottom;
      const spaceAbove = btnRect.top;

      if (ddRect.height > spaceBelow && spaceAbove > spaceBelow) {
        setDropdownPosition((prev) => ({
          ...prev,
          top: btnRect.top - ddRect.height - 4,
        }));
      } else {
        setDropdownPosition((prev) => ({
          ...prev,
          top: btnRect.bottom + 4,
        }));
      }
    };

    const raf = requestAnimationFrame(adjustPosition);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, isMeasured, options.length, maxHeight]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsMeasured(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const dropdownContent = isOpen && (
    <div
      ref={dropdownRef}
      className={`fixed bg-gray-800 border-2 border-blue-600 rounded-2xl shadow-lg py-1 ${maxHeight} overflow-y-auto`}
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
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {allowClear && (
        <button
          type="button"
          className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700 text-gray-400"
          onClick={() => handleOptionClick('')}
        >
          Clear selection
        </button>
      )}
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={`block w-full text-left px-3 py-2 text-sm hover:bg-blue-600 hover:text-white
            ${
              option.selected || option.value === value
                ? 'bg-gray-700 font-medium'
                : ''
            }`}
          onClick={() => handleOptionClick(option.value)}
        >
          {renderOption ? renderOption(option) : option.label}
        </button>
      ))}
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
            ${
              disabled ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-650'
            } ${sizeClasses[size]} ${className}`}
        >
          <span className="truncate ml-2 font-semibold">{displayValue}</span>
          <span
            className="transition-transform duration-200 ml-2 flex-shrink-0"
            style={{
              display: 'flex',
              alignItems: 'center',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </span>
        </button>
      </div>

      {isOpen && createPortal(dropdownContent, document.body)}
    </>
  );
}
