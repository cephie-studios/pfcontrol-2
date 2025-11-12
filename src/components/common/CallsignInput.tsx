import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Combine both the main input value and dropdown search filter
    const mainSearchTerm = value.toUpperCase();
    const dropdownSearchTerm = dropdownSearch.toUpperCase();

    let filtered = airlines;

    // Filter by main input value if exists
    if (value) {
      filtered = airlines.filter(
        (airline) =>
          airline.icao.toUpperCase().startsWith(mainSearchTerm) ||
          airline.callsign.toUpperCase().startsWith(mainSearchTerm) ||
          airline.callsign.toUpperCase().includes(mainSearchTerm)
      );
    }

    // Further filter by dropdown search if exists
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    onChange(newValue);
    setShowSuggestions(true);
  };

  const handleAirlineSelect = (icao: string) => {
    onChange(icao);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  // Parse the callsign to check if it's valid
  const parsedCallsign = useMemo(() => {
    if (!value || value.length < 4) return null;

    const callsignPattern = /^([A-Z]{2,3})(\d+[A-Z]?)$/;
    const match = value.match(callsignPattern);

    if (!match) return null;

    const airlineCode = match[1];
    const flightNumber = match[2];
    const airline = airlines.find((a) => a.icao === airlineCode);

    if (airline) {
      const formattedName = airline.callsign
        .split(' ')
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(' ');
      return `${formattedName} ${flightNumber}`;
    }

    return null;
  }, [value, airlines]);

  return (
    <div className="relative">
      {/* Input box */}
      <div
        className={`relative bg-gray-800 border-2 border-blue-600 transition-all duration-75 ${
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
          required={required}
          placeholder={placeholder}
          className="w-full pl-6 pr-10 p-3 bg-transparent text-white font-semibold focus:outline-none"
          maxLength={maxLength}
        />
        {filteredAirlines.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronDown
              className={`h-5 w-5 transition-transform duration-300 ${showSuggestions ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Dropdown suggestions */}
      {showSuggestions && filteredAirlines.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full bg-gray-800 border-2 border-blue-600 border-t-0 rounded-b-3xl shadow-2xl"
        >
          {/* Divider line */}
          <div className="border-t border-blue-600/50 mx-4" />

          {/* Suggestions list */}
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

      {value.length > 0 && filteredAirlines.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          <span>
            {value.length <= 4
              ? 'Select an airline ICAO code and your flight number (e.g., DLH123 for Lufthansa 123), '
              : `Found ${filteredAirlines.length} matching airline${filteredAirlines.length === 1 ? '' : 's'}. Click to use the ICAO code.`}
          </span>
        </div>
      )}
      {value.length > 0 && filteredAirlines.length === 0 && (
        <div className="mt-2 text-xs text-gray-400">
          {parsedCallsign ? (
            <span className="text-green-400">
              <span className="font-semibold pl-5">{parsedCallsign}</span>
            </span>
          ) : (
            <span>
              No airlines found. You can still enter any callsign manually.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
