import type { Placement } from "react-joyride";

export const steps: {
  target: string;
  title: string;
  content: string;
  placement: Placement;
  disableNext?: boolean;
}[] = [
  {
    target: '#start-session-btn',
    title: 'Start a Session',
    content: 'Click here to start a new control session.',
    placement: 'bottom' as Placement,
  },
  {
    target: '#pfatc-flights-btn',
    title: 'See PFATC Flights',
    content: 'View PFATC flights here.',
    placement: 'bottom' as Placement,
  },
  {
    target: '#start-session-btn',
    title: '',
    content: '',
    placement: 'left' as Placement,
    disableNext: true,
  },
];