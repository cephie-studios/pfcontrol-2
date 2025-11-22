import type { Placement } from 'react-joyride';

export const steps: {
  target: string;
  title: string;
  content: string;
  placement: Placement;
  disableNext: boolean;
  isLast?: boolean;
}[] = [
  {
    target: '#account-settings',
    title: 'Account Settings',
    content:
      'Manage your account connections (Roblox, VATSIM) and restart the tutorial if needed.',
    placement: 'top' as Placement,
    disableNext: true,
  },
  {
    target: '#table-column-settings',
    title: 'Table Columns',
    content:
      'Customize which columns appear in your departure and arrival flight tables.',
    placement: 'top' as Placement,
    disableNext: true,
  },
  {
    target: '#layout-settings',
    title: 'Layout Settings',
    content:
      'Configure table display options, like combined view and flight row transparency.',
    placement: 'top' as Placement,
    disableNext: true,
  },
  {
    target: '#acars-settings',
    title: 'ACARS Settings',
    content:
      'Set up ACARS terminal panels (notes, charts) and adjust their sizes.',
    placement: 'top' as Placement,
    disableNext: true,
  },
  {
    target: '#sound-settings',
    title: 'Sound Settings',
    content: 'Enable/disable notification sounds and adjust their volumes.',
    placement: 'top' as Placement,
    disableNext: true,
  },
  {
    target: '#background-image-settings',
    title: 'Background Images',
    content: 'Choose or upload custom background images for your sessions.',
    placement: 'top' as Placement,
    disableNext: true,
    isLast: true,
  },
];
