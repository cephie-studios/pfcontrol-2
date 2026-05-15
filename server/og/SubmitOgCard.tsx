export interface SubmitOgStatItem {
  label: string;
  value: string;
}

export interface SubmitOgCardProps {
  airportIcao: string;
  networkLabel: string;
  atisSnippet: string | null;
  stats: SubmitOgStatItem[];
  backgroundDataUrl: string | null;
}

const W = 1200;
const H = 630;
const BORDER_RADIUS = 25;

export function SubmitOgCard({
  airportIcao,
  networkLabel,
  atisSnippet,
  stats,
  backgroundDataUrl,
}: SubmitOgCardProps) {
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
            display: 'flex',
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
            paddingRight: 64,
            paddingTop: 48,
            paddingBottom: 48,
            maxWidth: 920,
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
            {airportIcao}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              marginBottom: stats.length > 0 ? 28 : atisSnippet ? 16 : 0,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#93c5fd',
                backgroundColor: 'rgba(37, 99, 235, 0.22)',
                border: '1px solid rgba(96, 165, 250, 0.35)',
                borderRadius: 999,
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 6,
                paddingBottom: 6,
              }}
            >
              {networkLabel}
            </div>
          </div>

          {stats.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 36,
                marginBottom: atisSnippet ? 22 : 0,
              }}
            >
              {stats.map((stat) => (
                <div
                  key={`${stat.label}-${stat.value}`}
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

          {atisSnippet ? (
            <div
              style={{
                fontSize: 17,
                fontWeight: 500,
                color: '#e8e8ed',
                lineHeight: 1.4,
                maxWidth: 680,
                textShadow:
                  '0 1px 2px rgba(0,0,0,0.75), 0 0 12px rgba(0,0,0,0.45)',
              }}
            >
              {atisSnippet}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}