import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessModalProps {
    message: string | null;
    onClose: () => void;
}

export const SuccessModal = ({ message, onClose }: SuccessModalProps) => {
    if (!message) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-neutral-dark/40 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-3xl border border-neutral-base/10 bg-white p-8 flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in duration-200">
                <div className="w-full rounded-full bg-primary px-4 py-3 font-semibold text-white hover:opacity-90 transition">
                    <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-bold text-neutral-dark text-center">Thao tác thành công</h3>
                <p className="text-neutral-base/80 text-center font-medium mb-4">{message}</p>
                <Button onClick={onClose} className="w-full bg-secondary hover:bg-secondary/90 text-white py-6 rounded-full font-bold text-lg">
                    Đóng
                </Button>
            </div>
        </div>
    );
};
