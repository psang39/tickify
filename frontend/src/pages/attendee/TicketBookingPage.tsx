import React, { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/axiosClient";
import { BookingStepper } from "../../components/booking/BookingStepper";
import { StageCanvas } from "@/features/seatmap/components/StageCanvas";
import { Button } from "../../components/ui/button";
import { CheckoutCountdown } from "@/features/seatmap/components/CheckoutCountdown";
import { useCartStore } from "@/store/useCartStore";
import { Trash2, Filter, User, Phone, MapPin, Mail, Edit2, CreditCard } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import { ErrorModal } from "@/components/shared/ErrorModal";
import { EventInfoHeader } from "@/features/seatmap/components/EventInfoHeader";
import { PaymentSummarySidebar } from "@/features/booking/components/PaymentSummarySidebar";
import { PaymentSuccessPanel } from "@/features/booking/components/PaymentSuccessPanel";
import { SeatMapLoadingState } from "@/features/booking/components/SeatMapLoadingState";
export default function TicketBookingPage() {
    const navigate = useNavigate();
    const isPayingRef = useRef(false);
    const { showId } = useParams();
    const [orderData, setOrderData] = useState<any>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { selectedSeats, comboCount, setComboCount, clearCart, removeSeat } = useCartStore() as any;
    const [currentStep, setCurrentStep] = useState(2);
    const [liveSeatsData, setLiveSeatsData] = useState<any[]>([]);
    const [zoneSummaries, setZoneSummaries] = useState<Record<string, any>>({});

    // STATE CHO SIDEBAR FILTER
    const [filterMinPrice, setFilterMinPrice] = useState<number | ''>('');
    const [filterMaxPrice, setFilterMaxPrice] = useState<number | ''>('');
    const [selectedTicketTypes, setSelectedTicketTypes] = useState<string[]>([]);

    const [purchaserInfo, setPurchaserInfo] = useState({
        fullName: "",
        email: "",
        phone: ""
    });
    const [paymentMethod, setPaymentMethod] = useState("MOCK");

    useEffect(() => {
        const shouldBlock = orderData?.order_id && (currentStep === 3 || currentStep === 4) && !isPayingRef.current;
        if (!shouldBlock) return;

        window.history.pushState(null, '', window.location.href);

        const handleBrowserBack = (e: PopStateEvent) => {
            const confirmBack = window.confirm(
                "Việc quay lại sẽ hủy bỏ các ghế bạn đang giữ chỗ. Bạn có chắc chắn muốn chọn lại ghế không?"
            );

            if (confirmBack) {
                if (orderData?.order_id) {
                    api.post(`/orders/release`, { order_id: orderData.order_id }, {
                        headers: { 'x-checkout-token': localStorage.getItem(`checkoutToken_${showId}`) }
                    }).catch(err => console.error("Lỗi nhả ghế khi back:", err));
                }
                clearCart();
                navigate(-1);
            } else {
                window.history.pushState(null, '', window.location.href);
            }
        };

        window.addEventListener('popstate', handleBrowserBack);

        return () => {
            window.removeEventListener('popstate', handleBrowserBack);
        };
    }, [orderData, currentStep, showId, clearCart, navigate]);


    useEffect(() => {
        if (!showId) return;

        const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
        if (!checkoutToken) {
            console.warn("Bạn chưa xếp hàng hoặc Token hết hạn. Đang điều hướng về phòng chờ...");
            navigate(`/queue/${showId}`, { replace: true });
        }
    }, [showId, navigate]);
    const trackingRef = useRef({ step: 2, orderId: null as string | null });

    useEffect(() => {
        trackingRef.current = { step: currentStep, orderId: orderData?.order_id };
    }, [currentStep, orderData]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const { step, orderId } = trackingRef.current;

            // NẾU ĐANG ĐI THANH TOÁN -> TUYỆT ĐỐI KHÔNG HIỆN POPUP CẢNH BÁO CỦA TRÌNH DUYỆT
            if (isPayingRef.current) return;

            if (orderId && (step === 3 || step === 4)) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);

            const { step, orderId } = trackingRef.current;

            // NẾU ĐANG DI CHUYỂN SANG VNPAY -> BỎ QUA KHÔNG ĐƯỢC CHẠY LỆNH HỦY GHẾ
            if (isPayingRef.current) {
                console.log("Hệ thống chuyển hướng thanh toán an toàn. Giữ nguyên trạng thái ghế.");
                return;
            }

            // Chỉ thực thi giải phóng ghế khi đóng tab vĩnh viễn hoặc crash ứng dụng
            if (orderId && (step === 3 || step === 4)) {
                const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

                fetch(`${baseUrl}/orders/release`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-checkout-token': checkoutToken || '',

                    },
                    body: JSON.stringify({ order_id: orderId }),
                    keepalive: true,
                    credentials: 'include'
                }).catch(err => console.error("Lỗi tự động nhả ghế:", err));
            }
        };
    }, [showId]);
    // ==========================================
    // FETCH DỮ LIỆU BẰNG TANSTACK QUERY
    // ==========================================
    const { data: userData } = useQuery({
        queryKey: ['current-user'],
        queryFn: async () => {
            const res = await api.get(`/user/profile`);
            return res.data?.data || res.data;
        },
    });
    const { data: ticketTypesData = [] } = useQuery({
        queryKey: ['ticket-types', showId],
        queryFn: async () => {
            const res = await api.get(`/shows/${showId}/ticket-types`);
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
    useEffect(() => {
        if (showDataPayload?.zone_summaries) {
            console.log("Dữ liệu tóm tắt khu vực mới nhận được:", showDataPayload.zone_summaries);
            setZoneSummaries(showDataPayload.zone_summaries);
        }
    }, [showDataPayload?.zone_summaries]);
    const mapAssets = showInfo?.map_assets || [];

    const zoneDictionary = useMemo(() => {
        const dict: Record<string, any> = {};
        zonesData.forEach((zone: any) => {
            dict[zone._id] = zone;
            if (zone.id && zone.id !== zone._id) dict[zone.id] = zone;
        });
        return dict;
    }, [zonesData]);

    const ticketTypeDictionary = useMemo(() => {
        const dict: Record<string, any> = {};
        (ticketTypesData || []).forEach((t: any) => {
            dict[t._id] = t;
            if (t.id && t.id !== t._id) dict[t.id] = t;
        });
        return dict;
    }, [ticketTypesData]);
    useEffect(() => {
        const keys = Object.keys(ticketTypeDictionary);
        if (keys.length === 0 || filterMinPrice !== '' || filterMaxPrice !== '') return;
        const prices = Object.values(ticketTypeDictionary)
            .map((t: any) => Number(t.price))
            .filter(Number.isFinite);
        if (prices.length === 0) return;
        setFilterMinPrice(Math.min(...prices));
        setFilterMaxPrice(Math.max(...prices));
        setSelectedTicketTypes(keys);
    }, [ticketTypeDictionary]);

    const handlePriceBlur = () => {
        let min = Number(filterMinPrice) || 0;
        let max = Number(filterMaxPrice) || 0;
        if (min > max) {
            setFilterMinPrice(max);
            setFilterMaxPrice(min);
        }
    };

    const toggleTicketTypeFilter = (typeId: string) => {
        setSelectedTicketTypes(prev =>
            prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
        );
    };

    const filteredLiveSeatsData = useMemo(() => {
        const min = Number(filterMinPrice) || 0;
        const max = filterMaxPrice === '' ? Infinity : Number(filterMaxPrice);

        return liveSeatsData.map(seat => {
            const typeId = ticketTypeDictionary[seat.ticket_type_id]?._id || seat.ticket_type_id;
            const seatPrice = ticketTypeDictionary[typeId]?.price || 0;

            const isPriceMatch = seatPrice >= min && seatPrice <= max;
            const isTypeMatch = selectedTicketTypes.length === 0 || selectedTicketTypes.includes(typeId);

            if (!isPriceMatch || !isTypeMatch) {
                return { ...seat, status: 'locked' };
            }
            return seat;
        });
    }, [liveSeatsData, filterMinPrice, filterMaxPrice, selectedTicketTypes]);

    // ==========================================
    // KẾT NỐI REAL-TIME SSE
    // ==========================================
    useEffect(() => {
        if (!showId) return;
        const checkoutKey = `checkoutToken_${showId}`;
        const token = localStorage.getItem(checkoutKey);
        if (!token) return;
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

        const sse = new EventSource(`${API_URL}/shows/${showId}/stream`, { withCredentials: true });

        sse.onopen = () => console.log("Đã kết nối Real-time (SSE)");
        sse.onerror = (err) => console.error("Lỗi mất kết nối SSE", err);

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
            setErrorMessage(errorMsg);
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
            const errorMsg = error.response?.data?.message || "Lỗi khi giữ ghế.";
            setErrorMessage(errorMsg);
            setCurrentStep(2);
            clearCart();
            setOrderData(null);
        }
    });

    const createPaymentMutation = useMutation({
        mutationFn: async (payload: any) => {
            isPayingRef.current = true;
            const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
            const res = await api.post(`/payments/create-url`, payload, {
                headers: { 'x-checkout-token': checkoutToken }
            });
            return res.data;
        },
        onSuccess: (data) => {
            if (data?.data?.paymentUrl) {
                window.location.href = data.data.paymentUrl;
            }
        },
        onError: (error: any) => {
            isPayingRef.current = false;
            const errorMsg = error.response?.data?.message || "Lỗi khởi tạo thanh toán.";
            setErrorMessage(errorMsg);
        }
    });

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStep]);

    const handleNext = () => {
        if (currentStep === 2) {
            if (selectedSeats.length === 0) {
                setErrorMessage("Vui lòng chọn ít nhất 1 ghế!");
                return;
            }

            const payloadItems = selectedSeats.map((seat: any) => {
                const typeId = seat.ticket_type_id?._id || seat.ticket_type_id;
                return {
                    seat_id: seat._id || seat.id,
                    ticket_type_id: typeId || null
                };
            });

            const hasMissingTicketType = payloadItems.some((item: any) => !item.ticket_type_id);
            if (hasMissingTicketType) {
                setErrorMessage("Hệ thống đang đồng bộ dữ liệu hạng vé. Vui lòng thử lại trong giây lát!");
                return;
            }

            holdSeatsMutation.mutate({ items: payloadItems });

        } else if (currentStep === 3) {
            setCurrentStep(4);
        } else if (currentStep === 4) {
            if (!purchaserInfo.fullName || !purchaserInfo.email || !purchaserInfo.phone) {
                setErrorMessage("Vui lòng điền đầy đủ thông tin liên hệ!");
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

    const tempTotalPrice = selectedSeats.reduce((sum: number, seat: any) => sum + (ticketTypeDictionary[seat.ticket_type_id]?.price || 0), 0);

    // ==========================================
    // RENDER NỘI DUNG TỪNG BƯỚC
    // ==========================================
    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return <div className="h-[400px] flex items-center justify-center text-gray-500">Bước 1</div>;
            case 2:
                if (isLoadingShow || isLoadingSeats) {
                    return <SeatMapLoadingState />;
                }

                return (
                    <div className="w-full flex flex-col gap-6">
                        {/* PHẦN 1: MAIN CONTENT (CANVAS + SIDEBAR) */}
                        <div className="flex flex-col lg:flex-row gap-6 w-full">

                            {/* CỘT TRÁI (Canvas) */}
                            <div className="flex-1 min-w-0 flex flex-col gap-4">
                                {/* Legend */}
                                <div className="flex justify-end gap-6 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium">
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-400 rounded-sm"></div> <span>Đã bán</span></div>
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border border-gray-300 rounded-sm"></div> <span>Trống</span></div>
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-primary rounded-sm "></div> <span className="font-bold">Đang chọn</span></div>
                                </div>

                                {/* Canvas */}
                                <div className="w-full h-[500px] bg-primary/5 rounded-2xl overflow-hidden border-2 border-primary/20 relative shadow-inner">
                                    <StageCanvas
                                        mapAssets={mapAssets}
                                        zonesData={zonesData}
                                        seatsData={filteredLiveSeatsData}
                                        zoneSummaries={zoneSummaries}
                                        ticketTypeDictionary={ticketTypeDictionary}
                                        zoneDictionary={zoneDictionary}
                                    />
                                </div>

                                {/* Danh sách ghế đã chọn */}
                                {selectedSeats.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                        {selectedSeats.map((seat: any, idx: number) => {
                                            const typeId = seat.ticket_type_id?._id || seat.ticket_type_id;
                                            const typeName = ticketTypeDictionary[typeId]?.name || "Vé";
                                            return (
                                                <div key={seat._id || idx} className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl hover:border-pink-300 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                                                        <span className="text-sm font-medium text-slate-700 truncate">{typeName}, Hàng {seat.row}, Ghế {seat.seat_number || seat.col_index}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 shrink-0">
                                                        <span className="font-bold text-slate-800">{(ticketTypeDictionary[typeId]?.price || 0).toLocaleString('vi-VN')} đ</span>
                                                        <button onClick={() => removeSeat && removeSeat(seat._id || seat.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={18} /></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* CỘT PHẢI (Sidebar Filter) - h-fit giúp nó không bị kéo dãn vô lý */}
                            <div className="w-full lg:w-[320px] shrink-0 bg-white border border-slate-200 rounded-2xl p-6  h-fit lg:sticky lg:top-6 py-8">
                                <div className="flex items-center gap-2 text-lg font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6">
                                    <Filter size={20} className="text-primary" /> Lọc vé
                                </div>

                                {/* 1. Select Số lượng vé */}
                                <div className="mb-8">
                                    <label className="block text-sm font-bold text-slate-700 mb-3">Số lượng vé liền kề</label>
                                    <select
                                        className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none bg-white text-slate-700 font-medium cursor-pointer"
                                        value={comboCount}
                                        onChange={(e) => setComboCount(Number(e.target.value))}
                                    >
                                        <option value={1}>1 Vé (Cho phép ghế đơn)</option>
                                        <option value={2}>2 Vé đi cùng nhau</option>
                                        <option value={3}>3 Vé đi cùng nhau</option>
                                        <option value={4}>4 Vé đi cùng nhau</option>
                                        <option value={5}>5 Vé đi cùng nhau</option>
                                    </select>
                                </div>

                                {/* 2. Khoảng giá */}
                                <div className="mb-8">
                                    <label className="block text-sm font-bold text-slate-700 mb-3">Khoảng giá (VNĐ)</label>
                                    <div className="px-2 mb-6">
                                        <Slider
                                            value={[Number(filterMinPrice) || 0, filterMaxPrice === '' ? 10000000 : Number(filterMaxPrice)]}
                                            max={10000000}
                                            min={0}
                                            step={50000}
                                            onValueChange={(values) => {
                                                setFilterMinPrice(values[0]);
                                                setFilterMaxPrice(values[1]);
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input type="number" value={filterMinPrice} onChange={(e) => setFilterMinPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center" />
                                        <span className="text-slate-400 font-bold">-</span>
                                        <input type="number" value={filterMaxPrice} onChange={(e) => setFilterMaxPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center" />
                                    </div>
                                </div>

                                {/* 3. Ticket Types */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-3">Hạng vé</label>
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                        {ticketTypesData.map((type: any) => (
                                            <label key={type.id} className="flex items-start gap-3 cursor-pointer">
                                                <input type="checkbox" checked={selectedTicketTypes.includes(type.id)} onChange={() => toggleTicketTypeFilter(type.id)} className="mt-1" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-700">{type.name}</span>
                                                    <span className="text-xs text-slate-500">{(type.price || 0).toLocaleString('vi-VN')} đ</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PHẦN 2: FOOTER ACTION (Nằm ngoài 2 cột, tràn toàn màn hình) */}
                        <div className="sticky bottom-0 bg-white/80  border-t border-slate-200 p-6 flex justify-between items-center  z-20">
                            <Button variant="outline" className="px-8 py-6 rounded-full border-gray-300 text-gray-700 font-bold h-12" onClick={() => navigate(-1)}>
                                Đổi ngày
                            </Button>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-sm text-slate-500">Tổng cộng ({selectedSeats.length} vé)</p>
                                    <p className="text-2xl font-black text-pink-600">{tempTotalPrice.toLocaleString('vi-VN')} đ</p>
                                </div>
                                <Button
                                    onClick={handleNext}
                                    disabled={selectedSeats.length === 0 || holdSeatsMutation.isPending}
                                    className="bg-[#ec4899] hover:bg-[#db2777] text-white px-10 py-6 rounded-full font-bold h-12 text-lg"
                                >
                                    Mua vé
                                </Button>
                            </div>
                        </div>
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
                                {selectedSeats.map((seat: any, index: any) => (
                                    <div key={index} className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary/10 text-primary font-bold rounded-lg flex items-center justify-center">
                                                {seat.seat_number || seat.id}
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500">Khu: {zoneDictionary[seat.zone_id]?.name || 'Unknown'}, Hàng: {seat.row}, Cột: {seat.col_index}</p>
                                            </div>
                                        </div>
                                        <span className="font-mono font-bold text-slate-700">
                                            {(ticketTypeDictionary[seat.ticket_type_id]?.price || 0).toLocaleString('vi-VN')} đ
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
            case 4: return (
                <div className=" w-full min-h-[500px] flex flex-col lg:flex-row gap-10 items-start py-8 ">

                    <div className="bg-white flex-1 w-full flex flex-col gap-10 px-6 rounded-2xl border border-slate-200 py-8">

                        <div>
                            <h3 className="text-l font-medium text-blue-700 mb-6 flex items-center gap-3">
                                1. Xác nhận thông tin <Edit2 size={18} className="text-slate-400 cursor-pointer hover:text-blue-600" />
                            </h3>

                            <div className="ml-2 pl-6 border-l-4 border-pink-300 flex flex-col gap-5">
                                <div className="flex items-center gap-4 text-slate-700">
                                    <User size={20} className="text-slate-400 shrink-0" />
                                    <input
                                        type="text"
                                        name="fullName"
                                        value={purchaserInfo.fullName}
                                        onChange={handleInputChange}
                                        className="w-full bg-transparent outline-none font-medium placeholder-slate-300"
                                        placeholder="Nhập họ và tên người nhận vé"
                                    />
                                </div>
                                <div className="flex items-center gap-4 text-slate-700">
                                    <Phone size={20} className="text-slate-400 shrink-0" />
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={purchaserInfo.phone}
                                        onChange={handleInputChange}
                                        className="w-full bg-transparent outline-none font-medium placeholder-slate-300"
                                        placeholder="Nhập số điện thoại liên hệ"
                                    />
                                </div>
                                <div className="flex items-center gap-4 text-slate-700">
                                    <MapPin size={20} className="text-slate-400 shrink-0" />
                                    <input
                                        type="text"
                                        className="w-full bg-transparent outline-none font-medium placeholder-slate-300 text-slate-500"
                                        placeholder="Địa chỉ (Tùy chọn)"
                                        defaultValue="Ho Chi Minh City, Vietnam"
                                    />
                                </div>
                                <div className="flex items-center gap-4 text-slate-700">
                                    <Mail size={20} className="text-slate-400 shrink-0" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={purchaserInfo.email}
                                        onChange={handleInputChange}
                                        className="w-full bg-transparent outline-none font-medium placeholder-slate-300"
                                        placeholder="Nhập email nhận vé điện tử"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Phần 2: Phương thức thanh toán */}
                        <div>
                            <h3 className="text-l font-medium text-blue-700 mb-6">
                                2. Chọn phương thức thanh toán
                            </h3>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                                <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3 text-slate-600 font-medium">
                                    <CreditCard size={18} /> Các phương thức khả dụng
                                </div>

                                <div className="p-6 flex flex-wrap gap-4">
                                    <div
                                        onClick={() => setPaymentMethod('VNPAY')}
                                        className={`w-32 h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${paymentMethod === 'VNPAY' ? 'border-blue-500 bg-blue-50/50 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="font-black text-blue-700 text-l tracking-tighter">VNPAY</div>
                                        <span className="text-[10px] text-slate-500 font-medium">QR / ATM</span>
                                    </div>
                                    <div
                                        onClick={() => setPaymentMethod('MOCK')}
                                        className={`w-32 h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${paymentMethod === 'MOCK' ? 'border-blue-500 bg-blue-50/50 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="font-bold text-slate-700 text-lg">MOCK</div>
                                        <span className="text-[10px] text-slate-500 font-medium">Test Gateway</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <PaymentSummarySidebar
                        orderId={orderData?.order_id}
                        showName={showInfo?.name}
                        selectedSeatCount={selectedSeats.length}
                        totalPrice={tempTotalPrice}
                        isPaying={createPaymentMutation.isPending}
                        onPay={handleNext}
                    />
                </div>)
            case 5:
                return (
                    <PaymentSuccessPanel
                        email={purchaserInfo.email || orderData?.billing_email}
                        onBackHome={() => navigate('/')}
                        onViewTickets={() => navigate('/tickets')}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className={`min-h-screen ${currentStep === 4 ? 'bg-gray-50' : 'bg-background'} relative`}>
            <LoadingOverlay isVisible={holdSeatsMutation.isPending || createPaymentMutation.isPending || releaseSeatsMutation.isPending} />
            <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />


            <main className="max-w-[1440px] mx-auto px-8 py-6">
                {/* Header Tiêu đề sự kiện */}

                <EventInfoHeader
                    showInfo={showInfo}
                    isLoadingShow={isLoadingShow}
                    currentStep={currentStep}
                    showId={showId as string}
                    orderData={orderData}
                    onBack={handleBack}
                />




                <BookingStepper currentStep={currentStep} />

                <div className={`${currentStep === 4 ? 'bg-gray-50' : 'bg-background'} rounded-2xl p-2`}>
                    {renderStepContent()}
                </div>

                {/* THANH ĐIỀU HƯỚNG CHUNG BÊN DƯỚI (Chỉ hiện ở bước 3) */}
                {currentStep !== 2 && currentStep !== 5 && currentStep !== 4 && (
                    <div className="mt-8 flex justify-between items-center border-t border-gray-200 pt-6 pb-10">
                        {/* Nút lùi này là dự phòng ở dưới cùng màn hình */}
                        <Button variant="ghost" onClick={handleBack} disabled={releaseSeatsMutation.isPending} className="text-gray-500">
                            Hủy & Quay lại
                        </Button>
                        <Button
                            onClick={handleNext}
                            disabled={createPaymentMutation.isPending}
                            className="bg-primary hover:bg-pink-700 text-white px-12 py-6 rounded-full font-bold text-lg"
                        >
                            Tiếp tục
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
