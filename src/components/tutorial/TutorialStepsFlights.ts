import type { Placement } from "react-joyride";

export const steps: {
  target: string;
  title: string;
  content: string;
  placement?: Placement;
  disableNext: boolean;
  isLast?: boolean;
  disableBeacon?: boolean;
}[] = [
  {
    target: '#utc-time',
    title: 'UTC Time',
    content: 'This shows the current UTC time for coordination with pilots worldwide.',
    placement: 'bottom' as Placement,
    disableNext: true,
  },
  {
    target: '#submit-link-btn',
    title: 'Submit Link',
    content: 'Share this link with pilots to submit flight plans directly to your session.',
    placement: 'bottom' as Placement,
    disableNext: true,
  },
  {
    target: '#view-link-btn',
    title: 'View Link',
    content: 'This is the link to access your session. Copy and share it securely.',
    placement: 'bottom' as Placement,
    disableNext: true,
  },
  {
    target: '#wind-display',
    title: 'Wind and Weather',
    content: 'Displays live METAR data including wind, temperature, visibility, and pressure. Click to toggle QNH/Altimeter.',
    disableNext: true,
  },
  {
    target: '#frequency-display',
    title: 'Frequencies',
    content: 'Lists radio frequencies for your airport. Expand to see all frequencies.',
    placement: 'bottom' as Placement,
    disableNext: true,
  },
  {
    target: '#toolbar-middle',
    title: 'Session Status',
    content: 'Shows your airport ICAO, connection status, and active controllers (avatars with roles).',
    placement: 'bottom' as Placement,
    disableNext: true,
  },
  {
    target: '#view-tabs',
    title: 'View Tabs',
    content: 'Switch between departures and arrivals (available in PFATC sessions).',
    placement: 'bottom' as Placement,
    disableNext: true,
  },
  {
    target: '#position-dropdown',
    title: 'Select Your Position',
    content: 'Choose your controlling position (e.g., Tower, Approach) to filter flights and show relevant statuses.',
    placement: 'bottom' as Placement,
    disableNext: true,
  },
  {
    target: '#runway-dropdown-toolbar',
    title: 'Active Runway',
    content: 'Set the active runway for departures. This updates ATIS and session settings.',
    placement: 'bottom' as Placement,
    disableNext: true,
  },
  {
    target: '#atis-button',
    title: 'ATIS Information',
    content: 'Click to manage ATIS (weather and runway info). Keep it updated for pilots.',
    placement: 'left' as Placement,
    disableNext: true,
  },
  {
    target: '#chat-button',
    title: 'Chat',
    content: 'Open the chat sidebar to communicate with other controllers.',
    placement: 'left' as Placement,
    disableNext: true,
  },
  {
    target: '#contact-button',
    title: 'Contact ACARS',
    content: 'Send messages directly to pilots via ACARS (available in PFATC sessions).',
    placement: 'left' as Placement,
    disableNext: true,
  },
  {
    target: '#add-departure-btn',
    title: 'Add Custom Flights',
    content: 'Add manual flight strips if needed. Useful for missing flights.',
    placement: 'top' as Placement,
    disableNext: true,
  },
  {
    target: '#departure-table',
    title: 'Flight Strips Overview',
    content: 'This is your departure table. Edit fields like callsign, runway, or status. Use PDC for clearances.',
    placement: 'top' as Placement,
    disableNext: true,
  },
  {
    target: '#settings-button',
    title: 'Settings',
    content: 'Click to open settings and customize your experience. It will guide you through options.',
    placement: 'left' as Placement,
    disableNext: true,
    isLast: true,
  },
  {
    target: '#settings-button',
    title: '',
    content: '',
    placement: 'left' as Placement,
    disableNext: true,
  },
];