import { Button } from '@/components/ui/button';

type PaymentSuccessPanelProps = {
  email?: string;
  onBackHome: () => void;
  onViewTickets: () => void;
};

export function PaymentSuccessPanel({ email, onBackHome, onViewTickets }: PaymentSuccessPanelProps) {
  return (
    <div className="w-full min-h-[500px] bg-[#f8fafc] rounded-xl relative overflow-hidden flex flex-col items-center justify-center p-8 border border-slate-100 dark:border-white/10">
      <div className="absolute top-[15%] left-[20%] w-2 h-2 bg-emerald-400 rotate-45 opacity-60" />
      <div className="absolute top-[25%] right-[25%] w-2.5 h-2.5 bg-emerald-300 opacity-50" />
      <div className="absolute bottom-[20%] left-[28%] w-1.5 h-1.5 bg-emerald-500 opacity-60 rounded-full" />
      <div className="absolute bottom-[30%] right-[22%] w-2 h-2 bg-emerald-400 rotate-12 opacity-50" />
      <div className="absolute top-[40%] left-[10%] w-2 h-2 bg-emerald-300 opacity-40" />
      <div className="absolute top-[35%] right-[10%] w-1.5 h-1.5 bg-emerald-500 rotate-45 opacity-60" />
      <div className="absolute bottom-[10%] right-[40%] w-2 h-2 bg-emerald-400 opacity-50" />
      <div className="absolute top-[10%] right-[45%] w-1.5 h-1.5 bg-emerald-300 opacity-60" />

      <div className="z-10 text-center flex flex-col items-center max-w-2xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-[#10b981] mb-4 flex items-center justify-center gap-3">
          Cảm ơn bạn! <span className="text-4xl">☺</span>
        </h2>
        <p className="text-l md:text-2xl font-medium text-[#10b981] mb-2">Giao dịch thanh toán thành công</p>
        <p className="text-lg text-[#10b981] mb-1">Vé điện tử đã được gửi đến hòm thư của bạn</p>
        <p className="text-lg font-bold text-[#059669] mb-10">{email || 'email@example.com'}</p>
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Button
            variant="outline"
            onClick={onBackHome}
            className="px-8 py-6 rounded-full border-gray-300 text-gray-700 dark:text-slate-200 font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 w-full sm:w-auto text-base h-14"
          >
            Về trang chủ
          </Button>
          <Button
            onClick={onViewTickets}
            className="bg-primary hover:bg-pink-600 text-white px-8 py-6 rounded-full font-bold shadow-lg shadow-pink-500/20 w-full sm:w-auto text-base h-14"
          >
            Xem vé của tôi
          </Button>
        </div>
      </div>
    </div>
  );
}
