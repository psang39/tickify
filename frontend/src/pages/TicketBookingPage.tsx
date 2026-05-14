import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axiosClient";
import { BookingStepper } from "../components/booking/BookingStepper";
import { StageCanvas } from "@/features/seatmap/components/StageCanvas";
import { Button } from "../components/ui/button";
import { jwtDecode } from 'jwt-decode';
import { CheckoutCountdown } from "@/features/seatmap/components/CheckoutCountdown";
import { useCartStore } from "@/store/useCartStore"; // 🔥 MỚI: Import Zustand Store

export default function TicketBookingPage() {
    const navigate = useNavigate();
    const { showId } = useParams();
    const [orderData, setOrderData] = useState<any>(null);

    // 🔥 MỚI: Lấy state từ Zustand thay vì useState
    const { selectedSeats, comboCount, setComboCount, clearCart } = useCartStore();
    // ==========================================
    // KIỂM TRA QUYỀN TRUY CẬP (ROUTE GUARD)
    // ==========================================
    // useEffect(() => {
    //     const checkAccess = () => {
    //         const checkoutKey = `checkoutToken_${showId}`;
    //         const token = localStorage.getItem(checkoutKey);
    //         if (!token) {
    //             navigate(`/queue/${showId}`);
    //             return;
    //         }

    //         try {
    //             const decoded = jwtDecode(token) as any;
    //             const currentTime = Date.now() / 1000;
    //             if (decoded.exp && decoded.exp < currentTime) {
    //                 console.log("Vé đã hết hạn, tiến hành dọn dẹp...");
    //                 localStorage.removeItem(checkoutKey);
    //                 alert("Phiên chọn ghế đã hết hạn. Vui lòng xếp hàng lại!");
    //                 navigate(`/queue/${showId}`);
    //             }

    //             if (decoded.show_id !== showId) {
    //                 localStorage.removeItem(checkoutKey);
    //                 navigate(`/queue/${showId}`);
    //             }

    //         } catch (error) {
    //             localStorage.removeItem(checkoutKey);
    //             navigate(`/queue/${showId}`);
    //         }
    //     };

    //     checkAccess();
    // }, [showId, navigate]);

    const [currentStep, setCurrentStep] = useState(2);
    const [liveSeatsData, setLiveSeatsData] = useState<any[]>([]);
    const [zoneSummaries, setZoneSummaries] = useState<Record<string, any>>({});

    // ==========================================
    // FETCH DỮ LIỆU THẬT BẰNG TANSTACK QUERY
    // ==========================================

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
            // 🔥 SỬA LỖI: Lấy đúng Token động theo Show ID
            const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
            const res = await api.get(`/shows/${showId}/seats`, {
                headers: { 'x-checkout-token': checkoutToken }
            });
            return res.data;
        },
        enabled: !!showId
    });

    // Cập nhật live data ngay khi vừa fetch xong
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

                // 🔥 SỬA LỖI: Thêm type cho prev
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

                // 🔥 SỬA LỖI: Thêm type cho prevSeats
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
            console.log("Đóng kết nối SSE");
            sse.close();
        };
    }, [showId]);
    const holdSeatsMutation = useMutation({
        mutationFn: async (payload: { items: any[] }) => {
            const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
            const res = await api.post(`/orders/hold`, payload, {
                headers: { 'x-checkout-token': checkoutToken }
            });
            return res.data;
        },
        onSuccess: (data) => {
            setOrderData(data.data); // Lưu thông tin đơn hàng trả về
            setCurrentStep(3); // 🔥 THÀNH CÔNG THÌ SANG BƯỚC 3 (Summary)
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.message || "Lỗi khi giữ ghế.";
            alert(errorMsg);
            // Thất bại thì ở lại Bước 2 (không cần làm gì vì setCurrentStep không chạy)

            // Trải nghiệm UX: Nếu ghế bị ai đó nẫng tay trên (409) hoặc lỗi mồ côi (400), 
            // tự động đẩy user về lại Bước 2 (Bản đồ) để chọn ghế khác.
            if (error.response?.status === 409 || error.response?.status === 400) {
                setCurrentStep(2);
                clearCart(); // Dọn giỏ hàng để họ chọn lại
            }
        }
    });
    // ==========================================
    // LOGIC ĐIỀU HƯỚNG BƯỚC
    // ==========================================
    const handleNext = () => {
        if (currentStep === 2) {
            // KIỂM TRA TRƯỚC KHI GỌI API
            if (selectedSeats.length === 0) {
                alert("Vui lòng chọn ít nhất 1 ghế!");
                return;
            }

            // CHUẨN BỊ PAYLOAD
            const payloadItems = selectedSeats.map(seat => {
                const zone = zonesData.find((z: any) => z._id === seat.zone_id);
                const ticketType = zone?.ticket_type_ids?.find((tt: any) => tt.target_tier === seat.tier);

                return {
                    // 🔥 LƯU Ý: Phải dùng _id (ObjectId) của MongoDB nếu database dùng ObjectId
                    // Nếu DB dùng custom string thì mới dùng seat_number
                    seat_id: seat._id,
                    ticket_type_id: ticketType?._id
                };
            });
            console.log(payloadItems);
            // 🔥 GỌI API GIỮ GHẾ NGAY TẠI ĐÂY
            holdSeatsMutation.mutate({ items: payloadItems });

        } else if (currentStep === 3) {
            // Ở Bước 3, ghế đã được giữ rồi, chỉ việc sang Bước 4 (Thanh toán)
            setCurrentStep(4);
        } else if (currentStep < 5) {
            setCurrentStep((prev: number) => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep((prev: number) => prev - 1);
    };

    // ==========================================
    // RENDER NỘI DUNG
    // ==========================================
    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return <div className="h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl text-gray-500">Bước 1: Chọn Khu vực & Ngày giờ</div>;
            case 2:
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
                        {/* 🔥 MỚI: Thanh công cụ chọn Combo */}
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

                        {/* Gọi Component Canvas và truyền các prop đã được tối giản */}
                        <StageCanvas
                            mapAssets={mapAssets}
                            zonesData={zonesData}
                            seatsData={liveSeatsData}
                            zoneSummaries={zoneSummaries}
                        />
                    </div>
                );
            case 3:
                // Tính tổng tiền ở Frontend để hiển thị tạm thời
                const tempTotalPrice = selectedSeats.reduce((sum, seat) => sum + (seat.price || 0), 0);

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
                                                {/* <p className="font-bold text-slate-700">Khu vực: {seat.zone || 'Đang cập nhật'}</p> */}
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

                        <div className="mt-8 text-center bg-blue-50 text-blue-700 px-6 py-3 rounded-lg border border-blue-100">
                            <p className="font-medium text-sm">💡 Sau khi xác nhận, bạn sẽ có <strong className="text-blue-800 font-bold">10 phút</strong> để hoàn tất thanh toán. Quá thời gian này, ghế sẽ bị hủy.</p>
                        </div>
                    </div>
                );
            case 4:
                return <div className="h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl text-gray-500">Bước 4: Thanh toán</div>;
            case 5:
                return <div className="h-[400px] flex items-center justify-center border-2 border-dashed border-green-300 bg-green-50 rounded-xl text-green-600 font-bold text-xl">Thanh toán thành công!</div>;
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
                            {/* 🔥 SỬA LỖI: Render Component chuẩn thay vì gọi hàm */}
                            <CheckoutCountdown showId={showId as string} />
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
                    {renderStepContent()}
                </div>

                <div className="mt-8 flex justify-between items-center border-t border-gray-200 pt-6 pb-10">
                    <Button variant="ghost" onClick={handleBack} disabled={currentStep === 1 || currentStep === 5} className="text-gray-500">
                        Quay lại
                    </Button>
                    <Button
                        onClick={handleNext}
                        disabled={
                            currentStep === 5 ||
                            (currentStep === 2 && selectedSeats.length === 0) ||
                            holdSeatsMutation.isPending
                        }
                        className="bg-primary hover:bg-pink-700 text-white px-12 py-6 rounded-full font-bold text-lg"
                    >
                        {holdSeatsMutation.isPending ? "Đang xử lý ghế..." :
                            currentStep === 2 ? "Tiếp tục & Giữ chỗ" :
                                currentStep === 4 ? "Thanh toán ngay" : "Tiếp tục"}
                    </Button>
                </div>
            </main>
        </div>
    );
}