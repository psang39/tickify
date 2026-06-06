import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, RotateCcw } from 'lucide-react';
import { api } from '@/lib/axiosClient';
import { Button } from '@/components/ui/button';

export default function PaymentResultPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const orderId = searchParams.get('orderId') || '';
    const gatewayStatus = searchParams.get('status') || '';

    const { data: result, isLoading } = useQuery({
        queryKey: ['payment-result', orderId],
        queryFn: async () => {
            const response = await api.get(`/orders/${orderId}/payment-result`);
            return response.data?.data || response.data;
        },
        enabled: !!orderId,
        // Cho IPN ngầm có thời gian xử lý xong rồi FE tự refetch.
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === 'pending' ? 1500 : false;
        }
    });

    const canRetry = useMemo(() => {
        if (!result) return false;
        if (result.status !== 'pending') return false;
        if (!result.cancellationDeadline) return true;
        return new Date() <= new Date(result.cancellationDeadline);
    }, [result]);

    const retryPaymentMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/payments/create-url', {
                orderId,
                purchaserName: result?.purchaserName || '',
                purchaserPhone: result?.purchaserPhone || '',
                purchaserEmail: result?.email || '',
                paymentMethod: 'MOCK'
            });
            return response.data?.data || response.data;
        },
        onSuccess: (data) => {
            if (data?.paymentUrl) window.location.href = data.paymentUrl;
        }
    });

    if (isLoading) {
        return <div className="p-6 text-center">Đang kiểm tra kết quả thanh toán...</div>;
    }

    const isSuccess = result?.status === 'confirmed' || gatewayStatus === 'SUCCESS';
    const isFailedButRetryable = !isSuccess && canRetry;

    return (
        <div className="mx-auto max-w-xl p-6">
            <div className="rounded-2xl border bg-white dark:bg-slate-900/90 p-6 shadow-sm">
                <h1 className="text-2xl font-semibold">
                    {isSuccess ? 'Thanh toán thành công' : 'Thanh toán chưa hoàn tất'}
                </h1>

                <p className="mt-3 text-sm text-gray-600 dark:text-slate-300">
                    {isSuccess
                        ? 'Vé của bạn đang được hệ thống tạo và sẽ hiển thị trong tài khoản.'
                        : isFailedButRetryable
                            ? 'Giao dịch vừa rồi thất bại hoặc bị hủy. Ghế vẫn đang được giữ, bạn có thể thử thanh toán lại trước khi hết thời gian giữ chỗ.'
                            : 'Đơn hàng đã hết thời gian giữ chỗ hoặc không còn có thể thanh toán lại.'}
                </p>

                <div className="mt-6 flex gap-3">
                    {isFailedButRetryable && (
                        <Button
                            onClick={() => retryPaymentMutation.mutate()}
                            disabled={retryPaymentMutation.isPending}
                            className="gap-2"
                        >
                            {retryPaymentMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RotateCcw className="h-4 w-4" />
                            )}
                            Thanh toán lại
                        </Button>
                    )}

                    <Button variant="outline" onClick={() => navigate('/')}>
                        Về trang chủ
                    </Button>
                </div>
            </div>
        </div>
    );
}
