import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorModalProps {
    message: string | null;
    onClose: () => void;
}

export const ErrorModal = ({ message, onClose }: ErrorModalProps) => {
    if (!message) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-neutral-dark/40 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-3xl border border-neutral-base/10 bg-white p-8 flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in duration-200">
                <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center text-error mb-2">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-2xl font-bold text-neutral-dark text-center">Đã có lỗi xảy ra</h3>
                <p className="text-neutral-base/80 text-center font-medium mb-4">{message}</p>
                <Button onClick={onClose} className="w-full bg-secondary hover:bg-secondary/90 text-white py-6 rounded-full font-bold text-lg">
                    Đóng
                </Button>
            </div>
        </div>
    );
};
