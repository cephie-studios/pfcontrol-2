import { useMemo } from 'react';
import { useData } from '../../hooks/data/useData';
import Dropdown from '../common/Dropdown';

interface AircraftDropdownProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showFullName?: boolean;
}

export default function AircraftDropdown({
  value,
  onChange,
  disabled = false,
  size = 'md',
  showFullName = true,
}: AircraftDropdownProps) {
  const { aircrafts, loading } = useData();

  const dropdownOptions = useMemo(() => {
    if (!Array.isArray(aircrafts)) {
      return [];
    }

    return aircrafts.map((aircraft) => ({
      value: aircraft.type,
      label: showFullName
        ? `${aircraft.type} - ${aircraft.name}`
        : aircraft.type,
    }));
  }, [aircrafts, showFullName]);

  const getDisplayValue = (selectedValue: string) => {
    if (!selectedValue) return loading ? 'Loading...' : 'Select Aircraft';

    if (!Array.isArray(aircrafts)) {
      return selectedValue;
    }

    const found = aircrafts.find((ac) => ac.type === selectedValue);
    return found
      ? showFullName
        ? `${found.type} - ${found.name}`
        : found.type
      : selectedValue;
  };

  return (
    <Dropdown
      options={dropdownOptions}
      placeholder={loading ? 'Loading...' : 'Select Aircraft'}
      value={value}
      onChange={onChange}
      disabled={disabled || loading}
      getDisplayValue={getDisplayValue}
      size={size}
    />
  );
}
