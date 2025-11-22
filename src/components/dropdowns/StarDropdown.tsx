import { useEffect, useMemo, useState } from 'react';
import { fetchStars } from '../../utils/fetch/data';
import Dropdown from '../common/Dropdown';

interface StarDropdownProps {
  airportIcao: string;
  value?: string;
  onChange: (star: string) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  placeholder?: string;
  disabled?: boolean;
}

export default function StarDropdown({
  airportIcao,
  value,
  onChange,
  size = 'md',
  placeholder = 'Select STAR',
  disabled = false,
}: StarDropdownProps) {
  const [stars, setStars] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedAirports, setFetchedAirports] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (airportIcao && !fetchedAirports.has(airportIcao)) {
      setIsLoading(true);
      fetchStars(airportIcao)
        .then((starData) => {
          setStars(starData);
          setFetchedAirports((prev) => new Set(prev).add(airportIcao));
        })
        .finally(() => setIsLoading(false));
    } else if (!airportIcao) {
      setStars([]);
    }
  }, [airportIcao, fetchedAirports]);

  const dropdownOptions = useMemo(() => {
    return stars.map((star) => ({
      value: star,
      label: star,
    }));
  }, [stars]);

  const getDisplayValue = (selectedValue: string) => {
    if (!selectedValue) {
      if (!airportIcao) return 'Select Airport First';
      if (isLoading) return 'Loading STARs...';
      if (stars.length === 0) return 'No STARs available';
      return placeholder;
    }
    return selectedValue;
  };

  return (
    <Dropdown
      options={dropdownOptions}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled || !airportIcao || isLoading}
      getDisplayValue={getDisplayValue}
      size={size}
    />
  );
}
