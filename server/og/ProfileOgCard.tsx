export interface ProfileOgCardProps {
  username: string;
  bioSnippet: string | null;
  rolesLine: string | null;
  memberSinceShort: string;
  isAdmin: boolean;
  statsLine: string | null;
  linksLine: string | null;
  ratingLine: string | null;
  avatarDataUrl: string;
}

const W = 1200;
const H = 630;

export function ProfileOgCard({
  username,
  bioSnippet,
  rolesLine,
  memberSinceShort,
  isAdmin,
  statsLine,
  linksLine,
  ratingLine,
  avatarDataUrl,
}: ProfileOgCardProps) {
  const detailLines = [statsLine, linksLine, ratingLine].filter(
    Boolean
  ) as string[];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: `${W}px`,
        height: `${H}px`,
        background: '#0c0c0e',
        color: '#fafafa',
        fontFamily: 'Inter',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: 64,
          paddingRight: 48,
          paddingTop: 56,
          paddingBottom: 56,
          maxWidth: 760,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 400,
            color: '#a1a1aa',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          PFControl
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.05,
            marginBottom: 20,
            color: '#ffffff',
          }}
        >
          {username}
        </div>
        {bioSnippet ? (
          <div
            style={{
              fontSize: 26,
              fontWeight: 400,
              color: '#d4d4d8',
              lineHeight: 1.35,
              marginBottom: 20,
            }}
          >
            {bioSnippet}
          </div>
        ) : null}
        <div
          style={{
            fontSize: 24,
            fontWeight: 400,
            color: '#a1a1aa',
            lineHeight: 1.4,
            marginBottom: 8,
          }}
        >
          {[rolesLine, `since ${memberSinceShort}`].filter(Boolean).join(' · ')}
          {isAdmin ? ' · PFControl team' : ''}
        </div>
        {detailLines.length > 0 ? (
          <div
            style={{
              fontSize: 22,
              fontWeight: 400,
              color: '#71717a',
              lineHeight: 1.45,
            }}
          >
            {detailLines.join(' · ')}
          </div>
        ) : null}
      </div>
      <div
        style={{
          width: 380,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingRight: 56,
        }}
      >
        <img
          src={avatarDataUrl}
          width={260}
          height={260}
          style={{
            borderRadius: 130,
            objectFit: 'cover',
          }}
        />
      </div>
    </div>
  );
}