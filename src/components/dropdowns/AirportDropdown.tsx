import { useMemo } from 'react';
import { useData } from '../../hooks/data/useData';
import Dropdown from '../common/Dropdown';

interface AirportDropdownProps {
  onChange: (value: string) => void;
  value?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showFullName?: boolean;
  className?: string;
}

export default function AirportDropdown({
  onChange,
  value,
  disabled = false,
  size = 'md',
  showFullName = true,
  className,
}: AirportDropdownProps) {
  const { airports, loading } = useData();

  const dropdownOptions = useMemo(() => {
    if (!Array.isArray(airports)) {
      return [];
    }

    return airports.map((airport) => ({
      value: airport.icao,
      label: showFullName ? `${airport.icao} - ${airport.name}` : airport.icao,
    }));
  }, [airports, showFullName]);

  const getDisplayValue = (selectedValue: string) => {
    if (!selectedValue) return loading ? 'Loading...' : 'Select Airport';

    if (!Array.isArray(airports)) {
      return selectedValue;
    }

    const found = airports.find((airport) => airport.icao === selectedValue);
    return found
      ? showFullName
        ? `${found.icao} - ${found.name}`
        : found.icao
      : selectedValue;
  };

  return (
    <Dropdown
      options={dropdownOptions}
      placeholder={loading ? 'Loading...' : 'Select Airport'}
      value={value}
      onChange={onChange}
      disabled={disabled || loading}
      getDisplayValue={getDisplayValue}
      size={size}
      className={className}
    />
  );
}
