import Button from './common/Button';

interface ACARSPanelProps {
    pdcContent: string | null;
    onDismiss?: () => void;
    onCopy?: () => void;
}

export default function ACARSPanel({ pdcContent, onDismiss, onCopy }: ACARSPanelProps) {
    if (!pdcContent) return null;

    return (
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-md">
            <h4 className="text-sm font-semibold text-blue-200 mb-2">
                Pre-Departure Clearance (PDC) received
            </h4>
            <pre className="bg-transparent text-xs text-white font-mono whitespace-pre-wrap">
                {pdcContent}
            </pre>
            <div className="mt-3 flex gap-2">
                <Button
                    onClick={() => {
                        if (onCopy) onCopy();
                        else navigator.clipboard?.writeText(pdcContent || '');
                    }}
                    variant="outline"
                >
                    Copy PDC
                </Button>
                <Button
                    onClick={() => {
                        if (onDismiss) onDismiss();
                    }}
                >
                    Dismiss
                </Button>
            </div>
        </div>
    );
}
// ...existing code...