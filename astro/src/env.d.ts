/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
}

declare namespace App {
  interface Locals {
    cspNonce?: string;
  }
}

declare module '@app/islands/HomeContent' {
  const HomeContent: () => import('react').JSX.Element;
  export default HomeContent;
}

declare module '@app/islands/PublicChrome' {
  export function PublicNavbar(): import('react').JSX.Element;
  export function PublicFooter(): import('react').JSX.Element;
}

declare module '@app/islands/ProfileContent' {
  interface ProfileContentProps {
    username: string;
  }
  const ProfileContent: (
    props: ProfileContentProps
  ) => import('react').JSX.Element;
  export default ProfileContent;
}

declare module '@app/islands/FlightContent' {
  interface FlightContentProps {
    flightId: string;
  }
  const FlightContent: (
    props: FlightContentProps
  ) => import('react').JSX.Element;
  export default FlightContent;
}
