import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../../hooks/data/useData';
import { ChevronDown } from 'lucide-react';

interface CallsignInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}

export default function CallsignInput({
  value,
  onChange,
  placeholder = 'e.g. DLH123',
  required = false,
  maxLength = 16,
}: CallsignInputProps) {
  const { airlines } = useData();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredAirlines, setFilteredAirlines] = useState(airlines);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [validationError, setValidationError] = useState<string>('');
  const [hasBlurred, setHasBlurred] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mainSearchTerm = value.toUpperCase();
    const dropdownSearchTerm = dropdownSearch.toUpperCase();

    let filtered = airlines;

    if (value) {
      filtered = airlines.filter(
        (airline) =>
          airline.icao.toUpperCase().startsWith(mainSearchTerm) ||
          airline.callsign.toUpperCase().startsWith(mainSearchTerm) ||
          airline.callsign.toUpperCase().includes(mainSearchTerm)
      );
    }

    if (dropdownSearch) {
      filtered = filtered.filter(
        (airline) =>
          airline.icao.toUpperCase().includes(dropdownSearchTerm) ||
          airline.callsign.toUpperCase().includes(dropdownSearchTerm)
      );
    }

    filtered.sort((a, b) => {
      const aIcaoMatch = a.icao.toUpperCase().startsWith(mainSearchTerm);
      const bIcaoMatch = b.icao.toUpperCase().startsWith(mainSearchTerm);
      const aCallsignMatch = a.callsign
        .toUpperCase()
        .startsWith(mainSearchTerm);
      const bCallsignMatch = b.callsign
        .toUpperCase()
        .startsWith(mainSearchTerm);

      if (aIcaoMatch && !bIcaoMatch) return -1;
      if (!aIcaoMatch && bIcaoMatch) return 1;
      if (aCallsignMatch && !bCallsignMatch) return -1;
      if (!aCallsignMatch && bCallsignMatch) return 1;
      return a.icao.localeCompare(b.icao);
    });

    setFilteredAirlines(filtered);
  }, [value, dropdownSearch, airlines]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validateCallsign = (callsign: string): string => {
    if (!callsign) {
      return '';
    }

    if (!/\d/.test(callsign)) {
      return 'Callsign must contain at least one number';
    }

    return '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    onChange(newValue);
    setShowSuggestions(true);
  };

  const handleAirlineSelect = (icao: string) => {
    onChange(icao);
    setShowSuggestions(false);
    setHasBlurred(true);
    setValidationError(validateCallsign(icao));
    inputRef.current?.blur();
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    setHasBlurred(true);
    if (value) {
      setValidationError(validateCallsign(value));
    }
  };

  const shouldShowError = hasBlurred && validationError && !showSuggestions;

  return (
    <div className="relative">
      <div
        className={`relative bg-gray-800 border-2 transition-all duration-75 z-10 ${
          shouldShowError ? 'border-red-600' : 'border-blue-600'
        } ${
          showSuggestions && filteredAirlines.length > 0
            ? 'rounded-t-3xl rounded-b-none border-b-0'
            : 'rounded-3xl'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleBlur}
          required={required}
          placeholder={placeholder}
          className="w-full pl-6 pr-10 p-3 bg-transparent text-white font-semibold focus:outline-none"
          maxLength={maxLength}
        />
        {filteredAirlines.length > 0 && (
          <ChevronDown
            className={`absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 transition-transform duration-300 ${showSuggestions ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {shouldShowError && (
        <div className="text-red-400 text-xs mt-1 ml-4 relative z-0">
          {validationError}
        </div>
      )}

      {showSuggestions && filteredAirlines.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full bg-gray-800 border-2 border-blue-600 border-t-0 rounded-b-3xl shadow-2xl"
        >
          <div className="border-t border-blue-600/50 mx-4" />

          <div
            className="max-h-64 overflow-y-auto py-2"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <style>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            {filteredAirlines.slice(0, 50).map((airline, index) => (
              <button
                key={`${airline.icao}-${airline.callsign}-${index}`}
                type="button"
                onClick={() => handleAirlineSelect(airline.icao)}
                className="w-full text-left px-4 py-2 hover:bg-blue-600 transition-colors rounded-lg mx-2"
                style={{ width: 'calc(100% - 1rem)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">{airline.icao}</span>
                  <span className="text-gray-400">-</span>
                  <span className="text-white">{airline.callsign}</span>
                </div>
              </button>
            ))}
            {filteredAirlines.length > 50 && (
              <div className="text-xs text-gray-400 px-4 py-2 text-center">
                +{filteredAirlines.length - 50} more... Keep typing to filter
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
