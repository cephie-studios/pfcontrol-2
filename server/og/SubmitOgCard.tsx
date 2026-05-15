export interface SubmitOgDetailItem {
  iconDataUrl: string;
  label: string;
  value: string;
}

export interface SubmitOgCardProps {
  airportIcao: string;
  networkLabel: string;
  atisSnippet: string | null;
  atisLetter: string | null;
  details: SubmitOgDetailItem[];
  backgroundDataUrl: string | null;
}

const W = 1200;
const H = 630;
const CARD_RADIUS = 28;

export function SubmitOgCard({
  airportIcao,
  networkLabel,
  atisSnippet,
  atisLetter,
  details,
  backgroundDataUrl,
}: SubmitOgCardProps) {
  const badgeLetter = atisLetter ?? airportIcao.slice(0, 1);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: `${W}px`,
        height: `${H}px`,
        borderRadius: 25,
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
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
            }}
          />
        </div>
      ) : null}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            maxWidth: 1040,
            borderRadius: CARD_RADIUS,
            backgroundColor: 'rgba(12, 12, 14, 0.82)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
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
              paddingLeft: 52,
              paddingRight: 36,
              paddingTop: 44,
              paddingBottom: 44,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#71717a',
                marginBottom: 10,
              }}
            >
              PFControl · Submit flight plan
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1,
                marginBottom: 12,
                color: '#ffffff',
              }}
            >
              {airportIcao}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                marginBottom: 28,
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

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 20,
                marginBottom: atisSnippet ? 24 : 0,
              }}
            >
              {details.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    minWidth: 180,
                    paddingLeft: 14,
                    paddingRight: 16,
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderRadius: 16,
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <img
                    src={item.iconDataUrl}
                    width={32}
                    height={32}
                    style={{ objectFit: 'contain' }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#a1a1aa',
                        marginBottom: 2,
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#ffffff',
                        lineHeight: 1.1,
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {atisSnippet ? (
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 400,
                  color: '#d4d4d8',
                  lineHeight: 1.45,
                  maxWidth: 620,
                }}
              >
                {atisSnippet}
              </div>
            ) : null}
          </div>

          <div
            style={{
              width: 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingRight: 44,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 220,
                height: 220,
                borderRadius: 110,
                backgroundColor: 'rgba(37, 99, 235, 0.28)',
                border: '2px solid rgba(96, 165, 250, 0.45)',
              }}
            >
              <div
                style={{
                  fontSize: atisLetter ? 96 : 72,
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1,
                }}
              >
                {badgeLetter}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}