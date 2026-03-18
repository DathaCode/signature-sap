import toast from 'react-hot-toast';

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

export function confirmToast(options: ConfirmOptions): Promise<boolean> {
    const {
        title,
        message,
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        variant = 'info',
    } = options;

    const config = VARIANT_CONFIG[variant];

    return new Promise((resolve) => {
        const toastId = toast.custom(
            (t) => (
                <div
                    className={`${
                        t.visible ? 'animate-enter' : 'animate-leave'
                    } pointer-events-auto flex flex-col gap-3 w-[360px] rounded-xl border ${config.border} bg-[#1B2B3A] p-5 shadow-2xl`}
                    style={{
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3)',
                    }}
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
                            onClick={() => {
                                toast.dismiss(toastId);
                                resolve(false);
                            }}
                            className="px-4 py-1.5 rounded-lg text-[13px] font-medium border border-slate-600 bg-transparent text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                toast.dismiss(toastId);
                                resolve(true);
                            }}
                            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold border-none text-white ${config.btnClass} transition-colors cursor-pointer`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            ),
            {
                duration: Infinity,
                position: 'top-center',
            }
        );
    });
}
