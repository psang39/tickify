import { Button } from '@/components/ui/button';

type PaymentSummarySidebarProps = {
  orderId?: string;
  showName?: string;
  selectedSeatCount: number;
  totalPrice: number;
  isPaying: boolean;
  onPay: () => void;
};

export function PaymentSummarySidebar({
  orderId,
  showName,
  selectedSeatCount,
  totalPrice,
  isPaying,
  onPay,
}: PaymentSummarySidebarProps) {
  return (
    <div className="w-full lg:w-[380px] shrink-0 rounded-[2rem] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.06)] self-start lg:sticky lg:top-6 bg-white dark:bg-slate-900/90 border border-white/10 dark:border-white/10">
      <div className="p-8 pb-6">
        <h3 className="text-l font-bold text-slate-100 dark:text-slate-100 mb-8">Chi tiết thanh toán</h3>
        <div className="space-y-4 text-sm">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span>Mã đơn hàng</span>
            <span className="font-mono text-slate-100 dark:text-slate-100">{orderId || '...'}</span>
          </div>
          <div className="flex justify-between items-start text-slate-500 dark:text-slate-400 pt-2">
            <div className="flex flex-col gap-1">
              <span>Giá vé: {showName || 'Sự kiện'}</span>
              <span className="text-xs text-slate-400">× {selectedSeatCount} vé</span>
            </div>
            <span className="font-medium text-slate-100 dark:text-slate-100">{totalPrice.toLocaleString('vi-VN')} đ</span>
          </div>
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span>Phí xử lý</span>
            <span className="font-medium text-slate-100 dark:text-slate-100">0 đ</span>
          </div>
        </div>
      </div>

      <div className="bg-[#222222] p-8 mt-2">
        <div className="flex justify-between items-end mb-6 text-white">
          <span className="text-lg font-medium opacity-90">Tổng cộng</span>
          <div className="flex flex-col items-end">
            <span className="text-[11px] opacity-60 font-mono mb-1">VND</span>
            <span className="text-3xl font-bold text-primary font-mono tracking-tight">
              {totalPrice.toLocaleString('vi-VN')}
            </span>
          </div>
        </div>

        <Button
          onClick={onPay}
          disabled={isPaying}
          className="w-full bg-primary hover:bg-pink-600 text-white py-7 rounded-full font-bold text-lg transition-all"
        >
          {isPaying ? 'Đang xử lý...' : 'Thanh toán ngay'}
        </Button>

        <p className="text-center text-xs text-slate-400 mt-4 opacity-60">
          Bằng việc thanh toán, bạn đồng ý với các điều khoản dịch vụ.
        </p>
      </div>
    </div>
  );
}
