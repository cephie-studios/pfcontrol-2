import { useEffect, useMemo } from 'react';
import { useData } from '../../hooks/data/useData';
import Dropdown from '../common/Dropdown';

interface SidDropdownProps {
  airportIcao: string;
  onChange: (value: string) => void;
  value?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  placeholder?: string;
}

export default function SidDropdown({
  airportIcao,
  onChange,
  value,
  disabled = false,
  size = 'md',
  placeholder = 'Select SID',
}: SidDropdownProps) {
  const { airportSids, fetchAirportData, fetchedAirports } = useData();

  useEffect(() => {
    if (airportIcao && !fetchedAirports.has(airportIcao)) {
      fetchAirportData(airportIcao);
    }
  }, [airportIcao, fetchedAirports, fetchAirportData]);

  const sids = useMemo(() => {
    return airportSids[airportIcao] || [];
  }, [airportSids, airportIcao]);

  const isLoading = useMemo(() => {
    return Boolean(
      airportIcao &&
        fetchedAirports.has(airportIcao) &&
        !airportSids[airportIcao]
    );
  }, [airportIcao, fetchedAirports, airportSids]);

  const dropdownOptions = useMemo(() => {
    return sids.map((sid) => ({
      value: sid,
      label: sid,
    }));
  }, [sids]);

  const getDisplayValue = (selectedValue: string) => {
    if (!selectedValue) {
      if (!airportIcao) return 'Select Airport First';
      if (isLoading) return 'Loading SIDs...';
      if (sids.length === 0) return 'No SIDs available';
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
