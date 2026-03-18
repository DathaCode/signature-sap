import { createRoot } from 'react-dom/client';

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
}

const VARIANT_CONFIG: Record<ConfirmVariant, { border: string; btnClass: string; icon: string }> = {
    danger: {
        border: 'border-red-500/20',
        btnClass: 'bg-red-600 hover:bg-red-700',
        icon: '\u26A0\uFE0F',
    },
    warning: {
        border: 'border-amber-500/20',
        btnClass: 'bg-amber-600 hover:bg-amber-700',
        icon: '\u26A0\uFE0F',
    },
    info: {
        border: 'border-[#C9A961]/20',
        btnClass: 'bg-[#C9A961] hover:bg-[#B8943F]',
        icon: '\u2139\uFE0F',
    },
};

function ConfirmDialog({
    options,
    onResolve,
}: {
    options: ConfirmOptions & { variant: ConfirmVariant };
    onResolve: (value: boolean) => void;
}) {
    const { title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant } = options;
    const config = VARIANT_CONFIG[variant];

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-24"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => onResolve(false)}
        >
            <div
                className={`flex flex-col gap-3 w-[380px] rounded-xl border ${config.border} bg-[#1B2B3A] p-6 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200`}
                style={{
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3)',
                    animation: 'confirmSlideIn 0.2s ease-out',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{config.icon}</span>
                        <span className="font-bold text-[15px] text-white">{title}</span>
                    </div>
                )}
                <p className="text-[13px] text-slate-300 leading-relaxed m-0">
                    {message}
                </p>
                <div className="flex justify-end gap-2 mt-1">
                    <button
                        onClick={() => onResolve(false)}
                        className="px-4 py-1.5 rounded-lg text-[13px] font-medium border border-slate-600 bg-transparent text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => onResolve(true)}
                        className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold border-none text-white ${config.btnClass} transition-colors cursor-pointer`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function confirmToast(options: ConfirmOptions): Promise<boolean> {
    const variant = options.variant || 'info';

    return new Promise((resolve) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        const cleanup = () => {
            root.unmount();
            container.remove();
        };

        const handleResolve = (value: boolean) => {
            cleanup();
            resolve(value);
        };

        root.render(
            <ConfirmDialog
                options={{ ...options, variant }}
                onResolve={handleResolve}
            />
        );
    });
}
