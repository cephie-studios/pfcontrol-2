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
    target: '#session-count-info',
    title: 'Session Limit',
    content:
      'You can only create a limited amount of sessions. If you reach the limit, delete an old one to make room.',
    placement: 'bottom' as Placement,
    disableNext: true,
  },
  {
    target: '#airport-dropdown',
    title: 'Select Airport',
    content:
      "Choose the airport where you'll be controlling. This sets the location for your session.",
    placement: 'right' as Placement,
    disableNext: true,
  },
  {
    target: '#runway-dropdown',
    title: 'Select Departure Runway',
    content:
      'Pick the active departure runway. This helps with wind and ATIS generation.',
    placement: 'right' as Placement,
    disableNext: true,
  },
  {
    target: '#arrival-runway-dropdown',
    title: 'Select Arrival Runway (Optional)',
    content:
      'Optionally set a different runway for arrivals. If not selected, the departure runway will be used for both.',
    placement: 'right' as Placement,
    disableNext: true,
  },
  {
    target: '#pfatc-checkbox',
    title: 'PFATC Network',
    content:
      "Check this if you're controlling on the PFATC Network. This makes your session publicly visible.",
    placement: 'top' as Placement,
    disableNext: true,
  },
  {
    target: '#create-session-btn',
    title: 'Create Your Session',
    content:
      "Click here to create your session and start controlling! You'll be taken to the flight management page.",
    placement: 'top' as Placement,
    disableNext: true,
    isLast: true,
  },
];
