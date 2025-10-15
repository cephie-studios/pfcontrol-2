import { useEffect, useMemo } from 'react';
import { useData } from '../../hooks/data/useData';
import Dropdown from '../common/Dropdown';

interface RunwayDropdownProps {
  airportIcao: string;
  onChange: (runway: string) => void;
  value?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  placeholder?: string;
  id?: string;
}

export default function RunwayDropdown({
  airportIcao,
  onChange,
  value,
  disabled = false,
  size = 'md',
  placeholder = 'Select Runway',
  id,
}: RunwayDropdownProps) {
  const { airportRunways, fetchAirportData, fetchedAirports } = useData();

  useEffect(() => {
    if (airportIcao && !fetchedAirports.has(airportIcao)) {
      fetchAirportData(airportIcao);
    }
  }, [airportIcao, fetchedAirports, fetchAirportData]);

  const runways = useMemo(() => {
    return airportRunways[airportIcao] || [];
  }, [airportRunways, airportIcao]);

  const isLoading = useMemo(() => {
    return Boolean(
      airportIcao &&
        fetchedAirports.has(airportIcao) &&
        !airportRunways[airportIcao]
    );
  }, [airportIcao, fetchedAirports, airportRunways]);

  const dropdownOptions = useMemo(() => {
    return runways.map((runway) => ({
      value: runway,
      label: runway,
    }));
  }, [runways]);

  const getDisplayValue = (selectedValue: string) => {
    if (!selectedValue) {
      if (!airportIcao) return 'Select Airport First';
      if (isLoading) return 'Loading runways...';
      if (runways.length === 0) return 'No runways available';
      return placeholder;
    }
    return selectedValue;
  };

  return (
    <Dropdown
      id={id}
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
