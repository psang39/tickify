import { Check } from "lucide-react";

const steps = [
  { id: 1, label: "Vị trí & thời gian" },
  { id: 2, label: "Chọn ghế" },
  { id: 3, label: "Xác nhận vé" },
  { id: 4, label: "Thanh toán" },
  { id: 5, label: "Nhận vé" },
];

export const BookingStepper = ({ currentStep = 2 }) => {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        {steps.map((step, index) => {
          const isDone = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center relative flex-1">
              {index !== 0 && (
                <div
                  className={`absolute right-1/2 top-4 h-[2px] w-full -translate-y-1/2 z-0 ${
                    step.id <= currentStep ? "bg-pink-500" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                />
              )}

              <div
                className={`z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-pink-600 text-white ring-4 ring-pink-100 dark:ring-pink-500/20"
                      : "border border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {isDone ? <Check size={16} strokeWidth={3} /> : step.id}
              </div>

              <span
                className={`mt-3 text-center text-xs font-medium sm:text-sm ${
                  isActive ? "font-bold text-pink-600 dark:text-pink-300" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
