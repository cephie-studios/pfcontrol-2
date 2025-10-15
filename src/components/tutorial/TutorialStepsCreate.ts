import type { Placement } from "react-joyride";

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
    content: 'You can create up to 10 sessions. If you reach the limit, delete an old one to make room.',
    placement: 'bottom' as Placement,
    disableNext: true,
  },
  {
    target: '#airport-dropdown',
    title: 'Select Airport',
    content: 'Choose the airport where you\'ll be controlling. This sets the location for your session.',
    placement: 'right' as Placement,
    disableNext: true,
  },
  {
    target: '#runway-dropdown',
    title: 'Select Runway',
    content: 'Pick the active departure runway. This helps with wind and ATIS generation.',
    placement: 'right' as Placement,
    disableNext: true,
  },
  {
    target: '#pfatc-checkbox',
    title: 'PFATC Network Option',
    content: 'Check this if you\'re controlling on the PFATC Network. Flights will be publicly viewable.',
    placement: 'right' as Placement,
    disableNext: true,
  },
  {
    target: '#create-session-btn',
    title: 'Create Your Session',
    content: 'Click here to create the session and start controlling. Make sure all fields are filled!',
    placement: 'bottom' as Placement,
    disableNext: true,
    isLast: true,
  },
];