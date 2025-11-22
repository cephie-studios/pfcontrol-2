import { useState, useEffect } from 'react';
import Dropdown from '../common/Dropdown';

interface AltitudeDropdownProps {
  value?: string;
  onChange: (altitude: string) => void;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  placeholder?: string;
}

export default function AltitudeDropdown({
  value,
  onChange,
  disabled = false,
  size = 'md',
  placeholder = 'Select Altitude',
}: AltitudeDropdownProps) {
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const altitudes: string[] = [];
  for (let i = 10; i <= 500; i += 5) {
    altitudes.push(i.toString().padStart(3, '0'));
  }

  const dropdownOptions = altitudes.map((alt) => ({
    value: alt,
    label: alt,
  }));

  const getDisplayValue = (selectedValue: string) => {
    if (!selectedValue) return placeholder;
    return selectedValue;
  };

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <Dropdown
      options={dropdownOptions}
      placeholder={placeholder}
      value={localValue}
      onChange={handleChange}
      disabled={disabled}
      getDisplayValue={getDisplayValue}
      size={size}
    />
  );
}
