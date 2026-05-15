export interface SubmitOgDetailItem {
  iconDataUrl?: string | null;
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
const ICON_COL_W = 56;
const TILE_ICON_IMG = 48;

function StatTile({
  item,
  spanFullRow,
}: {
  item: SubmitOgDetailItem;
  spanFullRow?: boolean;
}) {
  const hasIcon = Boolean(item.iconDataUrl?.trim());

  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: spanFullRow ? '100%' : 0,
        minWidth: 0,
        minHeight: 128,
        paddingLeft: 22,
        paddingRight: 22,
        paddingTop: 20,
        paddingBottom: 20,
        gap: 18,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div
        style={{
          width: ICON_COL_W,
          height: TILE_ICON_IMG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {hasIcon ? (
          <img
            src={item.iconDataUrl!}
            width={TILE_ICON_IMG}
            height={TILE_ICON_IMG}
            style={{ objectFit: 'contain' }}
          />
        ) : null}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#a1a1aa',
            marginBottom: 8,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.15,
            wordBreak: 'break-word',
          }}
        >
          {item.value}
        </div>
      </div>
    </div>
  );
}

export function SubmitOgCard({
  airportIcao,
  networkLabel,
  atisSnippet,
  atisLetter,
  details,
  backgroundDataUrl,
}: SubmitOgCardProps) {
  const badgeLetter = atisLetter ?? airportIcao.slice(0, 1);

  const detailRows: SubmitOgDetailItem[][] = [];
  for (let i = 0; i < details.length; i += 2) {
    detailRows.push(details.slice(i, i + 2));
  }

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
            maxWidth: 1080,
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
              paddingLeft: 48,
              paddingRight: 32,
              paddingTop: 40,
              paddingBottom: 40,
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1,
                marginBottom: 16,
                color: '#ffffff',
              }}
            >
              {airportIcao}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                marginBottom: 32,
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
                flexDirection: 'column',
                gap: 20,
                marginBottom: atisSnippet ? 24 : 0,
              }}
            >
              {detailRows.map((pair, rowIdx) => (
                <div
                  key={rowIdx}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 28,
                    width: '100%',
                  }}
                >
                  {pair.map((item, colIdx) => (
                    <StatTile
                      key={`${rowIdx}-${colIdx}-${item.label}`}
                      item={item}
                      spanFullRow={pair.length === 1}
                    />
                  ))}
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