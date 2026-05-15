export interface OgStatItem {
  value: string;
  label: string;
}

export interface OgLinkItem {
  platform: string;
  detail: string;
}

export interface ProfileOgCardProps {
  username: string;
  bioSnippet: string | null;
  metaLine: string | null;
  teamBadge: string | null;
  stats: OgStatItem[];
  links: OgLinkItem[];
  rating: { score: string; reviewCount: number } | null;
  avatarDataUrl: string;
  backgroundDataUrl: string | null;
}

const W = 1200;
const H = 630;
const BORDER_RADIUS = 15;

export function ProfileOgCard({
  username,
  bioSnippet,
  metaLine,
  teamBadge,
  stats,
  links,
  rating,
  avatarDataUrl,
  backgroundDataUrl,
}: ProfileOgCardProps) {
  const metaParts = [metaLine, teamBadge].filter(Boolean) as string[];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: `${W}px`,
        height: `${H}px`,
        borderRadius: BORDER_RADIUS,
        overflow: 'hidden',
        backgroundColor: '#0c0c0e',
      }}
    >
      {backgroundDataUrl ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${W}px`,
            height: `${H}px`,
          }}
        >
          <img
            src={backgroundDataUrl}
            width={W}
            height={H}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${W}px`,
              height: `${H}px`,
              objectFit: 'cover',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${W}px`,
              height: `${H}px`,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
          />
        </div>
      ) : null}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'row',
          width: `${W}px`,
          height: `${H}px`,
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
            paddingRight: 40,
            paddingTop: 48,
            paddingBottom: 48,
            maxWidth: 780,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#71717a',
              marginBottom: 10,
            }}
          >
            PFControl
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.05,
              marginBottom: 14,
              color: '#ffffff',
            }}
          >
            {username}
          </div>
          {metaParts.length > 0 ? (
            <div
              style={{
                fontSize: 18,
                fontWeight: 400,
                color: '#a1a1aa',
                lineHeight: 1.4,
                marginBottom: stats.length > 0 ? 28 : 16,
              }}
            >
              {metaParts.join(' · ')}
            </div>
          ) : null}
          {stats.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 36,
                marginBottom: bioSnippet ? 22 : 0,
              }}
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      fontSize: 42,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: '#ffffff',
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#a1a1aa',
                      marginTop: 8,
                      lineHeight: 1.2,
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {bioSnippet ? (
            <div
              style={{
                fontSize: 17,
                fontWeight: 400,
                color: '#71717a',
                lineHeight: 1.4,
                marginBottom: links.length > 0 || rating ? 14 : 0,
                maxWidth: 680,
              }}
            >
              {bioSnippet}
            </div>
          ) : null}
          {(links.length > 0 || rating) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 20,
                fontSize: 15,
                fontWeight: 400,
                color: '#52525b',
                lineHeight: 1.4,
              }}
            >
              {links.map((link) => (
                <span key={`${link.platform}-${link.detail}`}>
                  {link.platform}: {link.detail}
                </span>
              ))}
              {rating ? (
                <span>
                  Controller Rating {rating.score}/5 ({rating.reviewCount}{' '}
                  {rating.reviewCount === 1 ? 'review' : 'reviews'})
                </span>
              ) : null}
            </div>
          )}
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
    </div>
  );
}
