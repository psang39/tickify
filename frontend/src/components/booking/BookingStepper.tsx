import { Check } from "lucide-react";

const steps = [
    { id: 1, label: "Location & Date" },
    { id: 2, label: "Seat" },
    { id: 3, label: "Order Overview" },
    { id: 4, label: "Payment" },
    { id: 5, label: "Download" },
];

export const BookingStepper = ({ currentStep = 2 }) => {
    return (
        <div className="w-full py-6">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
                {steps.map((step, index) => (
                    <div key={step.id} className="flex flex-col items-center relative flex-1">

                        {/* Đường line nối ngang giữa các vòng tròn */}
                        {index !== 0 && (
                            <div
                                className={`absolute right-1/2 top-4 w-full h-[2px] -translate-y-1/2 z-0 
                ${step.id <= currentStep ? "bg-primary" : "bg-neutral-base"}`}
                            />
                        )}

                        {/* Vòng tròn hiển thị số hoặc dấu check */}
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center z-10 text-sm font-bold transition-all
              ${step.id < currentStep
                                    ? "bg-primary text-white" // Các bước đã qua: Màu hồng, chữ trắng
                                    : step.id === currentStep
                                        ? "bg-secondary text-white ring-4 ring-secondary/20" // Bước hiện tại: Màu xanh, có vòng sáng
                                        : "bg-neutral-base text-gray-400" // Các bước chưa tới: Màu xám đen
                                }`}
                        >
                            {step.id < currentStep ? <Check size={16} strokeWidth={3} /> : step.id}
                        </div>

                        {/* Chữ ghi chú ở dưới (Label) */}
                        <span
                            className={`mt-3 text-xs font-medium 
              ${step.id === currentStep ? "text-primary font-bold" : "text-gray-500"}`}
                        >
                            {step.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};