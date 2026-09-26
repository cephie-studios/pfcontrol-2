import type { ReactNode } from 'react';
import AdminTextInput from './AdminTextInput';

type AdminIconInputProps = {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'date' | 'datetime-local' | 'search';
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  label?: string;
  required?: boolean;
  'aria-label'?: string;
};

export default function AdminIconInput(props: AdminIconInputProps) {
  return <AdminTextInput {...props} />;
}
