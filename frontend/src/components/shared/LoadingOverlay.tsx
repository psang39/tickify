import { RefreshCw } from "lucide-react";

interface LoadingOverlayProps {
    isVisible: boolean;
    message?: string;
}

export const LoadingOverlay = ({ isVisible, message = "Vui lòng đợi trong giây lát..." }: LoadingOverlayProps) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-dark/40 backdrop-blur-sm px-4 transition-all duration-300">
            <div className="w-full max-w-sm rounded-3xl border border-neutral-base/10 bg-white p-10 flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in duration-200">
                <h3 className="text-2xl font-bold text-neutral-dark tracking-tight text-center">{message}</h3>
                <RefreshCw size={36} className="text-secondary animate-spin" />
            </div>
        </div>
    );
};
