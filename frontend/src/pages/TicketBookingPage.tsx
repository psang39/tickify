import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/axiosClient";
import { BookingStepper } from "../components/booking/BookingStepper";
import { StageCanvas } from "@/features/seatmap/components/StageCanvas";
import { Button } from "../components/ui/button";
import { CheckoutCountdown } from "@/features/seatmap/components/CheckoutCountdown";
import { useCartStore } from "@/store/useCartStore";

export default function TicketBookingPage() {
    const navigate = useNavigate();
    const { showId } = useParams();
    const [orderData, setOrderData] = useState<any>(null);

    const { selectedSeats, comboCount, setComboCount, clearCart } = useCartStore();
    const [currentStep, setCurrentStep] = useState(2);
    const [liveSeatsData, setLiveSeatsData] = useState<any[]>([]);
    const [zoneSummaries, setZoneSummaries] = useState<Record<string, any>>({});

    // 🔥 MỚI: State lưu thông tin thanh toán & phương thức
    const [purchaserInfo, setPurchaserInfo] = useState({
        fullName: "",
        email: "",
        phone: ""
    });
    const [paymentMethod, setPaymentMethod] = useState("MOCK");

    // ==========================================
    // KIỂM TRA QUYỀN TRUY CẬP (ROUTE GUARD)
    // ==========================================
    useEffect(() => {
        if (!showId) return;

        const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
        if (!checkoutToken) {
            console.warn("Bạn chưa xếp hàng hoặc Token hết hạn. Đang điều hướng về phòng chờ...");
            navigate(`/queue/${showId}`, { replace: true });
        }
    }, [showId, navigate]);

    // ==========================================
    // FETCH DỮ LIỆU BẰNG TANSTACK QUERY
    // ==========================================

    // 🔥 MỚI: Lấy thông tin User hiện tại để điền sẵn vào form
    const { data: userData } = useQuery({
        queryKey: ['current-user'],
        queryFn: async () => {
            const res = await api.get(`/users/me`); // Giả sử bạn có endpoint này
            return res.data?.data || res.data;
        },
    });
    useEffect(() => {
        if (userData) {
            setPurchaserInfo({
                fullName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
                email: userData.email || "",
                phone: userData.phone || ""
            });
        }
    }, [userData]);
    const { data: showDataPayload, isLoading: isLoadingShow } = useQuery({
        queryKey: ['show-details', showId],
        queryFn: async () => {
            const res = await api.get(`/shows/${showId}`);
            return res.data;
        },
        enabled: !!showId
    });

    const { data: seatsData = [], isLoading: isLoadingSeats } = useQuery({
        queryKey: ['show-seats', showId],
        queryFn: async () => {
            const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
            const res = await api.get(`/shows/${showId}/seats`, {
                headers: { 'x-checkout-token': checkoutToken }
            });
            return res.data?.data || res.data;
        },
        enabled: !!showId
    });

    useEffect(() => {
        if (seatsData.length > 0) {
            setLiveSeatsData(seatsData);
        }
    }, [seatsData]);

    const showInfo = showDataPayload?.show_info;
    const zonesData = showDataPayload?.zones || [];
    const mapAssets = showInfo?.map_assets || [];

    // ==========================================
    // KẾT NỐI REAL-TIME SSE
    // ==========================================
    useEffect(() => {
        if (!showId) return;
        const checkoutKey = `checkoutToken_${showId}`;
        const token = localStorage.getItem(checkoutKey);
        if (!token) return;

        const sse = new EventSource(`http://localhost:3000/api/v1/shows/${showId}/stream`);

        sse.onopen = () => console.log("🟢 Đã kết nối Real-time (SSE)");
        sse.onerror = (err) => console.error("🔴 Lỗi mất kết nối SSE", err);

        sse.addEventListener('ZONE_SUMMARY_UPDATES', (event: any) => {
            try {
                const parsedData = JSON.parse(event.data);
                const { zone_id, summary } = parsedData;
                const summaryObject = typeof summary === 'string' ? JSON.parse(summary) : summary;
                setZoneSummaries((prev: Record<string, any>) => ({
                    ...prev,
                    [zone_id]: summaryObject
                }));
            } catch (error) {
                console.error("Lỗi parse dữ liệu Zone:", error);
            }
        });

        sse.addEventListener('SEAT_UPDATES', (event: any) => {
            try {
                const parsedData = JSON.parse(event.data);
                const { seat_id, status } = parsedData;

                setLiveSeatsData((prevSeats: any[]) =>
                    prevSeats.map(seat =>
                        (seat._id === seat_id || seat.seat_number === seat_id)
                            ? { ...seat, status: status }
                            : seat
                    )
                );
            } catch (error) {
                console.error("Lỗi parse dữ liệu Seat:", error);
            }
        });

        return () => {
            sse.close();
        };
    }, [showId]);

    // ==========================================
    // MUTATIONS
    // ==========================================
    const holdSeatsMutation = useMutation({
        mutationFn: async (payload: { items: any[] }) => {
            const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
            const res = await api.post(`/orders/hold`, payload, {
                headers: { 'x-checkout-token': checkoutToken }
            });
            return res.data;
        },
        onSuccess: (data) => {
            setOrderData(data.data);
            setCurrentStep(3);
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.message || "Lỗi khi giữ ghế.";
            alert(errorMsg);
            if (error.response?.status === 409 || error.response?.status === 400) {
                setCurrentStep(2);
                clearCart();
            }
        }
    });

    const releaseSeatsMutation = useMutation({
        mutationFn: async (orderId: string) => {
            const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
            const res = await api.post(`/orders/release`, { order_id: orderId }, {
                headers: { 'x-checkout-token': checkoutToken }
            });
            return res.data;
        },
        onSuccess: () => {
            setCurrentStep(2);
            clearCart();
            setOrderData(null);
        },
        onError: (error: any) => {
            console.error("Lỗi nhả ghế:", error);
            setCurrentStep(2);
            clearCart();
            setOrderData(null);
        }
    });

    // 🔥 MỚI: API Khởi tạo thanh toán
    const createPaymentMutation = useMutation({
        mutationFn: async (payload: any) => {
            const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
            const res = await api.post(`/payments/create-url`, payload, {
                headers: { 'x-checkout-token': checkoutToken }
            });
            return res.data;
        },
        onSuccess: (data) => {
            if (data?.data?.paymentUrl) {
                // Redirect người dùng sang cổng thanh toán
                window.location.href = data.data.paymentUrl;
            }
        },
        onError: (error: any) => {
            alert(error.response?.data?.message || "Lỗi khởi tạo thanh toán.");
        }
    });

    // ==========================================
    // LOGIC ĐIỀU HƯỚNG BƯỚC
    // ==========================================
    const handleNext = () => {
        if (currentStep === 2) {
            if (selectedSeats.length === 0) {
                alert("Vui lòng chọn ít nhất 1 ghế!");
                return;
            }

            const payloadItems = selectedSeats.map(seat => {
                const ticketType = seat?.ticket_type_id;
                return {
                    seat_id: seat._id || seat.id,
                    ticket_type_id: ticketType || null
                };
            });

            const hasMissingTicketType = payloadItems.some(item => !item.ticket_type_id);
            if (hasMissingTicketType) {
                alert("Lỗi: Không tìm thấy Hạng Vé tương ứng cho ghế này.");
                return;
            }

            holdSeatsMutation.mutate({ items: payloadItems });

        } else if (currentStep === 3) {
            setCurrentStep(4);
        } else if (currentStep === 4) {
            // 🔥 MỚI: Gọi API Thanh toán ở Bước 4
            if (!purchaserInfo.fullName || !purchaserInfo.email || !purchaserInfo.phone) {
                alert("Vui lòng điền đầy đủ thông tin liên hệ!");
                return;
            }

            createPaymentMutation.mutate({
                orderId: orderData?.order_id,
                purchaserName: purchaserInfo.fullName,
                purchaserEmail: purchaserInfo.email,
                purchaserPhone: purchaserInfo.phone,
                paymentMethod: paymentMethod
            });
        }
    };

    const handleBack = () => {
        if (currentStep === 3 || currentStep === 4) {
            const confirmBack = window.confirm("Việc quay lại sẽ hủy bỏ các ghế bạn đang giữ chỗ. Bạn có chắc chắn muốn chọn lại ghế không?");
            if (confirmBack) {
                if (orderData?.order_id) {
                    releaseSeatsMutation.mutate(orderData.order_id);
                } else {
                    setCurrentStep(2);
                    clearCart();
                }
            }
        } else if (currentStep > 1) {
            setCurrentStep((prev: number) => prev - 1);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPurchaserInfo(prev => ({ ...prev, [name]: value }));
    };

    // ==========================================
    // RENDER NỘI DUNG
    // ==========================================
    const renderStepContent = () => {
        const tempTotalPrice = selectedSeats.reduce((sum, seat) => sum + (seat.price || 0), 0);

        switch (currentStep) {
            case 1:
                return <div className="h-[400px] flex items-center justify-center text-gray-500">Bước 1</div>;
            case 2:
                // ... (Phần hiển thị Canvas giữ nguyên như cũ)
                if (isLoadingShow || isLoadingSeats) {
                    return (
                        <div className="w-full h-[600px] flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-500 font-medium">Đang tải sơ đồ rạp...</p>
                        </div>
                    );
                }

                return (
                    <div className="w-full h-[600px] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 relative">
                        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md p-2 rounded-lg shadow-md border border-gray-200 flex gap-2 items-center">
                            <span className="text-sm font-bold text-gray-700 ml-2">Số vé cần mua:</span>
                            {[1, 2, 3, 4].map(num => (
                                <button
                                    key={num}
                                    onClick={() => setComboCount(num)}
                                    className={`w-8 h-8 rounded-full text-sm font-bold transition-all ${comboCount === num
                                        ? 'bg-primary text-white shadow-md'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                        <StageCanvas
                            mapAssets={mapAssets}
                            zonesData={zonesData}
                            seatsData={liveSeatsData}
                            zoneSummaries={zoneSummaries}
                        />
                    </div>
                );
            case 3:
                return (
                    <div className="w-full min-h-[500px] bg-white rounded-xl p-8 border border-gray-100 flex flex-col items-center">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6">Xác nhận thông tin vé</h2>

                        <div className="w-full max-w-2xl bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <div className="flex justify-between border-b border-slate-200 pb-4 mb-4 text-sm font-bold text-slate-500 uppercase tracking-wider">
                                <span>Vị trí ghế</span>
                                <span>Giá vé</span>
                            </div>

                            <div className="space-y-4 mb-6">
                                {selectedSeats.map((seat, index) => (
                                    <div key={index} className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary/10 text-primary font-bold rounded-lg flex items-center justify-center">
                                                {seat.seat_number || seat.id}
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500">Hàng: {seat.row} • Cột: {seat.col_index}</p>
                                            </div>
                                        </div>
                                        <span className="font-mono font-bold text-slate-700">
                                            {(seat.price || 0).toLocaleString('vi-VN')} đ
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center border-t border-slate-200 pt-6">
                                <span className="text-lg font-bold text-slate-600">Tổng thanh toán:</span>
                                <span className="text-2xl font-bold text-orange-500 font-mono">
                                    {tempTotalPrice.toLocaleString('vi-VN')} đ
                                </span>
                            </div>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="w-full min-h-[500px] bg-white rounded-xl p-8 border border-gray-100 flex flex-col items-center">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6">Thông tin & Thanh toán</h2>

                        <div className="w-full max-w-2xl flex flex-col gap-6">
                            {/* Form Thông tin người nhận vé */}
                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-700 mb-4">Thông tin nhận vé</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Họ và Tên</label>
                                        <input
                                            type="text"
                                            name="fullName"
                                            value={purchaserInfo.fullName}
                                            onChange={handleInputChange}
                                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                                            placeholder="Nhập họ và tên"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={purchaserInfo.email}
                                            onChange={handleInputChange}
                                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                                            placeholder="Nhập email"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Số điện thoại</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={purchaserInfo.phone}
                                            onChange={handleInputChange}
                                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                                            placeholder="Nhập số điện thoại"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Phương thức thanh toán */}
                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-700 mb-4">Phương thức thanh toán</h3>
                                <div className="flex flex-col gap-3">
                                    <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'VNPAY' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-100'}`}>
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="VNPAY"
                                            checked={paymentMethod === 'VNPAY'}
                                            onChange={() => setPaymentMethod('VNPAY')}
                                            className="w-5 h-5 text-primary"
                                        />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700">Thanh toán qua VNPAY</span>
                                            <span className="text-sm text-slate-500">Hỗ trợ thẻ ATM, Visa, Mastercard và QR Code</span>
                                        </div>
                                    </label>

                                    <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'MOCK' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-100'}`}>
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="MOCK"
                                            checked={paymentMethod === 'MOCK'}
                                            onChange={() => setPaymentMethod('MOCK')}
                                            className="w-5 h-5 text-primary"
                                        />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700">Mock Gateway (Test)</span>
                                            <span className="text-sm text-slate-500">Môi trường giả lập thanh toán cho đồ án</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-orange-50 border border-orange-200 p-4 rounded-xl">
                                <span className="font-bold text-orange-700">Cần thanh toán:</span>
                                <span className="text-xl font-bold text-orange-600 font-mono">
                                    {tempTotalPrice.toLocaleString('vi-VN')} đ
                                </span>
                            </div>
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="w-full min-h-[500px] bg-[#f8fafc] rounded-xl relative overflow-hidden flex flex-col items-center justify-center p-8 border border-slate-100">
                        {/* Hiệu ứng các hạt Confetti (Trang trí nền) */}
                        <div className="absolute top-[15%] left-[20%] w-2 h-2 bg-emerald-400 rotate-45 opacity-60"></div>
                        <div className="absolute top-[25%] right-[25%] w-2.5 h-2.5 bg-emerald-300 opacity-50"></div>
                        <div className="absolute bottom-[20%] left-[28%] w-1.5 h-1.5 bg-emerald-500 opacity-60 rounded-full"></div>
                        <div className="absolute bottom-[30%] right-[22%] w-2 h-2 bg-emerald-400 rotate-12 opacity-50"></div>
                        <div className="absolute top-[40%] left-[10%] w-2 h-2 bg-emerald-300 opacity-40"></div>
                        <div className="absolute top-[35%] right-[10%] w-1.5 h-1.5 bg-emerald-500 rotate-45 opacity-60"></div>
                        <div className="absolute bottom-[10%] right-[40%] w-2 h-2 bg-emerald-400 opacity-50"></div>
                        <div className="absolute top-[10%] right-[45%] w-1.5 h-1.5 bg-emerald-300 opacity-60"></div>

                        <div className="z-10 text-center flex flex-col items-center max-w-2xl mx-auto">
                            <h2 className="text-4xl md:text-5xl font-bold text-[#10b981] mb-4 flex items-center justify-center gap-3">
                                Cảm ơn bạn! <span className="text-4xl">☺</span>
                            </h2>
                            <p className="text-xl md:text-2xl font-medium text-[#10b981] mb-2">
                                Giao dịch thanh toán thành công
                            </p>
                            <p className="text-lg text-[#10b981] mb-1">
                                Vé điện tử đã được gửi đến hòm thư của bạn
                            </p>
                            <p className="text-lg font-bold text-[#059669] mb-10">
                                {purchaserInfo.email || orderData?.billing_email || "email@example.com"}
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                                <Button
                                    variant="outline"
                                    onClick={() => navigate('/')}
                                    className="px-8 py-6 rounded-full border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 w-full sm:w-auto text-base h-14"
                                >
                                    Về trang chủ
                                </Button>
                                <Button
                                    onClick={() => navigate('/my-tickets')} // Thay đổi route này trỏ về trang xem vé của bạn
                                    className="bg-[#ec4899] hover:bg-[#db2777] text-white px-8 py-6 rounded-full font-bold shadow-lg shadow-pink-500/20 w-full sm:w-auto text-base h-14"
                                >
                                    Xem vé của tôi
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-background font-sans">
            <header className="w-full bg-white border-b border-gray-200">
                <div className="max-w-[1440px] mx-auto px-8 py-4 flex justify-between items-center">
                    <div className="text-2xl font-bold text-secondary cursor-pointer" onClick={() => navigate("/")}>Tickify</div>
                    <div className="flex gap-4">
                        <Button variant="ghost" className="text-gray-500">Hỗ trợ</Button>
                        <Button variant="outline" className="border-secondary text-secondary">Hồ sơ</Button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1440px] mx-auto px-8 py-6">
                <BookingStepper currentStep={currentStep} />

                <div className="flex justify-between items-end mt-8 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">
                            {isLoadingShow ? "Đang tải sự kiện..." : showInfo?.name}
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">
                            {showInfo?.start_time ? new Date(showInfo.start_time).toLocaleString('vi-VN') : "..."} • {showInfo?.venue_id?.name || "Đang cập nhật địa điểm"}
                        </p>
                    </div>

                    {currentStep < 5 && (
                        <div className="text-right">
                            <CheckoutCountdown
                                showId={showId as string}
                                cancellationDeadline={currentStep >= 3 ? orderData?.cancellation_deadline : undefined}
                            />
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
                    {renderStepContent()}
                </div>

                <div className="mt-8 flex justify-between items-center border-t border-gray-200 pt-6 pb-10">
                    <Button variant="ghost" onClick={handleBack} disabled={currentStep === 1 || currentStep === 5 || releaseSeatsMutation.isPending} className="text-gray-500">
                        Quay lại
                    </Button>
                    <Button
                        onClick={handleNext}
                        disabled={
                            currentStep === 5 ||
                            (currentStep === 2 && selectedSeats.length === 0) ||
                            holdSeatsMutation.isPending ||
                            createPaymentMutation.isPending
                        }
                        className="bg-primary hover:bg-pink-700 text-white px-12 py-6 rounded-full font-bold text-lg"
                    >
                        {holdSeatsMutation.isPending ? "Đang xử lý ghế..." :
                            createPaymentMutation.isPending ? "Đang chuyển hướng..." :
                                currentStep === 2 ? "Tiếp tục & Giữ chỗ" :
                                    currentStep === 4 ? "Thanh toán ngay" : "Tiếp tục"}
                    </Button>
                </div>
            </main>
        </div>
    );
}