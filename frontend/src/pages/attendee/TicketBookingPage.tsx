import React, { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/axiosClient";
import { BookingStepper } from "../../components/booking/BookingStepper";
import { StageCanvas } from "@/features/seatmap/components/StageCanvas";
import { Button } from "../../components/ui/button";
import { useCartStore } from "@/store/useCartStore";
import {
  Trash2,
  User,
  Phone,
  MapPin,
  Mail,
  Edit2,
  CreditCard,
} from "lucide-react";
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
  const seatMapSectionRef = useRef<HTMLDivElement | null>(null);
  const { showId } = useParams();
  const [orderData, setOrderData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { selectedSeats, comboCount, setComboCount, clearCart, removeSeat, setStandingZoneQuantity } =
    useCartStore() as any;
  const [currentStep, setCurrentStep] = useState(2);
  const [liveSeatsData, setLiveSeatsData] = useState<any[]>([]);
  const [zoneSummaries, setZoneSummaries] = useState<Record<string, any>>({});

  // STATE CHO SIDEBAR FILTER
  const [filterMinPrice, setFilterMinPrice] = useState<number | "">("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | "">("");
  const [selectedTicketTypes, setSelectedTicketTypes] = useState<string[]>([]);
  const [activeFilterTab, setActiveFilterTab] = useState<
    "combo" | "price" | "ticketType"
  >("combo");
  const [isBackConfirmOpen, setIsBackConfirmOpen] = useState(false);
  const [activeStandingZoneId, setActiveStandingZoneId] = useState<string | null>(null);

  const [purchaserInfo, setPurchaserInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("MOCK");

  useEffect(() => {
    const shouldBlock =
      orderData?.order_id &&
      (currentStep === 3 || currentStep === 4) &&
      !isPayingRef.current;
    if (!shouldBlock) return;

    window.history.pushState(null, "", window.location.href);

    const handleBrowserBack = (_e: PopStateEvent) => {
      setIsBackConfirmOpen(true);
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handleBrowserBack);

    return () => {
      window.removeEventListener("popstate", handleBrowserBack);
    };
  }, [orderData, currentStep, showId, clearCart, navigate]);

  useEffect(() => {
    if (!showId) return;

    const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
    if (!checkoutToken) {
      console.warn(
        "Bạn chưa xếp hàng hoặc Token hết hạn. Đang điều hướng về phòng chờ...",
      );
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
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);

      const { step, orderId } = trackingRef.current;

      // NẾU ĐANG DI CHUYỂN SANG VNPAY -> BỎ QUA KHÔNG ĐƯỢC CHẠY LỆNH HỦY GHẾ
      if (isPayingRef.current) {
        console.log(
          "Hệ thống chuyển hướng thanh toán an toàn. Giữ nguyên trạng thái ghế.",
        );
        return;
      }

      // Chỉ thực thi giải phóng ghế khi đóng tab vĩnh viễn hoặc crash ứng dụng
      if (orderId && (step === 3 || step === 4)) {
        const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
        const baseUrl =
          import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

        fetch(`${baseUrl}/orders/release`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-checkout-token": checkoutToken || "",
          },
          body: JSON.stringify({ order_id: orderId }),
          keepalive: true,
          credentials: "include",
        }).catch((err) => console.error("Lỗi tự động nhả ghế:", err));
      }
    };
  }, [showId]);
  // ==========================================
  // FETCH DỮ LIỆU BẰNG TANSTACK QUERY
  // ==========================================
  const { data: userData } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const res = await api.get(`/user/profile`);
      return res.data?.data || res.data;
    },
  });
  const { data: ticketTypesData = [] } = useQuery({
    queryKey: ["ticket-types", showId],
    queryFn: async () => {
      const res = await api.get(`/shows/${showId}/ticket-types`);
      return res.data?.data || res.data;
    },
  });

  useEffect(() => {
    if (userData) {
      setPurchaserInfo({
        fullName:
          `${userData.first_name || ""} ${userData.last_name || ""}`.trim(),
        email: userData.email || "",
        phone: userData.phone || "",
      });
    }
  }, [userData]);

  const { data: showDataPayload, isLoading: isLoadingShow } = useQuery({
    queryKey: ["show-details", showId],
    queryFn: async () => {
      const res = await api.get(`/shows/${showId}`);
      return res.data;
    },
    enabled: !!showId,
  });

  const { data: seatsData = [], isLoading: isLoadingSeats } = useQuery({
    queryKey: ["show-seats", showId],
    queryFn: async () => {
      const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
      const res = await api.get(`/shows/${showId}/seats`, {
        headers: { "x-checkout-token": checkoutToken },
      });
      return res.data?.data || res.data;
    },
    enabled: !!showId,
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
      console.log(
        "Dữ liệu tóm tắt khu vực mới nhận được:",
        showDataPayload.zone_summaries,
      );
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

  const standingZones = useMemo(() => {
    return zonesData.filter((zone: any) => zone.is_standing);
  }, [zonesData]);

  const selectedCountByStandingZone = useMemo(() => {
    return selectedSeats.reduce((acc: Record<string, number>, seat: any) => {
      const zoneId = String(seat.zone_id || '');
      if (zoneDictionary[zoneId]?.is_standing) {
        acc[zoneId] = (acc[zoneId] || 0) + 1;
      }
      return acc;
    }, {});
  }, [selectedSeats, zoneDictionary]);

  const getAvailableStandingSeats = (zoneId: string) => {
    const selectedIds = new Set(selectedSeats.map((seat: any) => String(seat._id || seat.id)));
    return liveSeatsData
      .filter((seat: any) => String(seat.zone_id) === String(zoneId))
      .filter((seat: any) => seat.status === 'available' || seat.status === 1 || selectedIds.has(String(seat._id || seat.id)))
      .sort((a: any, b: any) => Number(a.col_index || 0) - Number(b.col_index || 0));
  };

  const updateStandingQuantity = (zone: any, nextQuantity: number) => {
    const normalizedQuantity = Math.max(0, Math.min(4, nextQuantity));
    setActiveStandingZoneId(zone._id);
    setStandingZoneQuantity(zone._id, getAvailableStandingSeats(zone._id), normalizedQuantity);
  };

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
    if (keys.length === 0 || filterMinPrice !== "" || filterMaxPrice !== "")
      return;
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
    setSelectedTicketTypes((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId],
    );
  };

  const filteredLiveSeatsData = useMemo(() => {
    const min = Number(filterMinPrice) || 0;
    const max = filterMaxPrice === "" ? Infinity : Number(filterMaxPrice);

    return liveSeatsData.map((seat) => {
      const typeId =
        ticketTypeDictionary[seat.ticket_type_id]?._id || seat.ticket_type_id;
      const seatPrice = ticketTypeDictionary[typeId]?.price || 0;

      const isPriceMatch = seatPrice >= min && seatPrice <= max;
      const isTypeMatch =
        selectedTicketTypes.length === 0 ||
        selectedTicketTypes.includes(typeId);

      if (!isPriceMatch || !isTypeMatch) {
        return { ...seat, status: "locked" };
      }
      return seat;
    });
  }, [
    liveSeatsData,
    filterMinPrice,
    filterMaxPrice,
    selectedTicketTypes,
    ticketTypeDictionary,
  ]);

  // ==========================================
  // KẾT NỐI REAL-TIME SSE
  // ==========================================
  useEffect(() => {
    if (!showId) return;
    const checkoutKey = `checkoutToken_${showId}`;
    const token = localStorage.getItem(checkoutKey);
    if (!token) return;
    const API_URL =
      import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

    const sse = new EventSource(`${API_URL}/shows/${showId}/stream`, {
      withCredentials: true,
    });

    sse.onopen = () => console.log("Đã kết nối Real-time (SSE)");
    sse.onerror = (err) => console.error("Lỗi mất kết nối SSE", err);

    sse.addEventListener("ZONE_SUMMARY_UPDATES", (event: any) => {
      try {
        const parsedData = JSON.parse(event.data);
        const { zone_id, summary } = parsedData;
        const summaryObject =
          typeof summary === "string" ? JSON.parse(summary) : summary;
        setZoneSummaries((prev: Record<string, any>) => ({
          ...prev,
          [zone_id]: summaryObject,
        }));
      } catch (error) {
        console.error("Lỗi parse dữ liệu Zone:", error);
      }
    });

    sse.addEventListener("SEAT_UPDATES", (event: any) => {
      try {
        const parsedData = JSON.parse(event.data);
        const { seat_id, status } = parsedData;

        setLiveSeatsData((prevSeats: any[]) =>
          prevSeats.map((seat) =>
            seat._id === seat_id || seat.seat_number === seat_id
              ? { ...seat, status: status }
              : seat,
          ),
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
        headers: { "x-checkout-token": checkoutToken },
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
    },
  });

  const releaseSeatsMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
      const res = await api.post(
        `/orders/release`,
        { order_id: orderId },
        {
          headers: { "x-checkout-token": checkoutToken },
        },
      );
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
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      isPayingRef.current = true;
      const checkoutToken = localStorage.getItem(`checkoutToken_${showId}`);
      const res = await api.post(`/payments/create-url`, payload, {
        headers: { "x-checkout-token": checkoutToken },
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
      const errorMsg =
        error.response?.data?.message || "Lỗi khởi tạo thanh toán.";
      setErrorMessage(errorMsg);
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (currentStep === 2 && seatMapSectionRef.current) {
        seatMapSectionRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [currentStep, isLoadingShow, isLoadingSeats]);

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
          ticket_type_id: typeId || null,
        };
      });

      const hasMissingTicketType = payloadItems.some(
        (item: any) => !item.ticket_type_id,
      );
      if (hasMissingTicketType) {
        setErrorMessage(
          "Hệ thống đang đồng bộ dữ liệu hạng vé. Vui lòng thử lại trong giây lát!",
        );
        return;
      }

      holdSeatsMutation.mutate({ items: payloadItems });
    } else if (currentStep === 3) {
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (
        !purchaserInfo.fullName ||
        !purchaserInfo.email ||
        !purchaserInfo.phone
      ) {
        setErrorMessage("Vui lòng điền đầy đủ thông tin liên hệ!");
        return;
      }

      createPaymentMutation.mutate({
        orderId: orderData?.order_id,
        purchaserName: purchaserInfo.fullName,
        purchaserEmail: purchaserInfo.email,
        purchaserPhone: purchaserInfo.phone,
        paymentMethod: paymentMethod,
      });
    }
  };

  const requestBackToSeatMap = () => {
    if (currentStep === 3 || currentStep === 4) {
      setIsBackConfirmOpen(true);
      return;
    }

    if (currentStep > 1) {
      setCurrentStep((prev: number) => prev - 1);
    }
  };

  const confirmBackToSeatMap = () => {
    setIsBackConfirmOpen(false);

    if (orderData?.order_id) {
      releaseSeatsMutation.mutate(orderData.order_id);
    } else {
      setCurrentStep(2);
      clearCart();
      setOrderData(null);
    }

  };

  const cancelBackToSeatMap = () => {
    setIsBackConfirmOpen(false);
  };

  const handleBack = requestBackToSeatMap;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPurchaserInfo((prev) => ({ ...prev, [name]: value }));
  };

  const tempTotalPrice = selectedSeats.reduce((sum: number, seat: any) => {
    const typeId = seat.ticket_type_id?._id || seat.ticket_type_id;
    return sum + (ticketTypeDictionary[typeId]?.price || 0);
  }, 0);

  const priceRangeMax = useMemo(() => {
    const prices = Object.values(ticketTypeDictionary)
      .map((t: any) => Number(t.price))
      .filter(Number.isFinite);
    return Math.max(1000000, ...(prices.length ? prices : [0]));
  }, [ticketTypeDictionary]);


  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="h-[400px] flex items-center justify-center text-gray-500">
            Bước 1
          </div>
        );
      case 2:
        if (isLoadingShow || isLoadingSeats) {
          return <SeatMapLoadingState />;
        }

        return (
          <div ref={seatMapSectionRef} className="w-full scroll-mt-6">
            <div className="mb-3 flex justify-end">
              <div className="flex items-center gap-5 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-slate-500 inline-block" />
                  <span>Đã bán</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-white border border-slate-300 inline-block" />
                  <span>Còn trống</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-pink-600 inline-block" />
                  <span>Đang chọn</span>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col xl:flex-row">
                <div className="relative flex-1 bg-white h-[560px] xl:h-[640px] overflow-hidden">
                  <div className="absolute left-6 top-5 z-10 rounded-2xl bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
                    <p className="text-base font-bold text-slate-800">
                      Chọn ghế của bạn
                    </p>
                    <p className="text-xs text-slate-500">
                      Phóng to, kéo bản đồ và chọn ghế còn trống.
                    </p>
                  </div>

                  <StageCanvas
                    mapAssets={mapAssets}
                    zonesData={zonesData}
                    seatsData={filteredLiveSeatsData}
                    zoneSummaries={zoneSummaries}
                    ticketTypeDictionary={ticketTypeDictionary}
                    zoneDictionary={zoneDictionary}
                    onStandingZoneClick={(zone: any) => updateStandingQuantity(zone, (selectedCountByStandingZone[zone._id] || 0) + 1)}
                  />
                </div>

                <aside className="w-full xl:w-[380px] border-t xl:border-t-0 xl:border-l border-slate-200 bg-white flex flex-col">
                  <div className="border-b border-slate-100 p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          Bộ lọc vé
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Lọc ghế theo nhu cầu trước khi chọn.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 rounded-2xl bg-slate-100 p-1 text-sm font-semibold text-slate-500">
                      <button
                        type="button"
                        onClick={() => setActiveFilterTab("combo")}
                        className={`rounded-xl px-2 py-2 transition-colors ${activeFilterTab === "combo" ? "bg-white text-primary shadow-sm" : "hover:text-slate-800"}`}
                      >
                        Số vé
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFilterTab("price")}
                        className={`rounded-xl px-2 py-2 transition-colors ${activeFilterTab === "price" ? "bg-white text-primary shadow-sm" : "hover:text-slate-800"}`}
                      >
                        Giá
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFilterTab("ticketType")}
                        className={`rounded-xl px-2 py-2 transition-colors ${activeFilterTab === "ticketType" ? "bg-white text-primary shadow-sm" : "hover:text-slate-800"}`}
                      >
                        Hạng vé
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5">
                    {activeFilterTab === "combo" && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-base font-bold text-slate-800">
                            Số vé muốn mua
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            Hệ thống ưu tiên gợi ý ghế liền kề.
                          </p>
                        </div>
                        <select
                          className="h-12 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-700 outline-none focus:border-primary"
                          value={comboCount}
                          onChange={(e) =>
                            setComboCount(Number(e.target.value))
                          }
                        >
                          <option value={1}>1 vé</option>
                          <option value={2}>2 vé liền kề</option>
                          <option value={3}>3 vé liền kề</option>
                          <option value={4}>4 vé liền kề</option>
                        </select>
                      </div>
                    )}

                    {activeFilterTab === "price" && (
                      <div className="space-y-5">
                        <div>
                          <p className="text-base font-bold text-slate-800">
                            Khoảng giá
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            Ghế ngoài khoảng giá sẽ được làm mờ và không thể
                            chọn.
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center text-base font-bold text-slate-800">
                          {(Number(filterMinPrice) || 0).toLocaleString(
                            "vi-VN",
                          )}{" "}
                          đ<span className="mx-2 text-slate-400">—</span>
                          {(filterMaxPrice === ""
                            ? priceRangeMax
                            : Number(filterMaxPrice)
                          ).toLocaleString("vi-VN")}{" "}
                          đ
                        </div>
                        <div className="px-2 py-2">
                          <Slider
                            value={[
                              Number(filterMinPrice) || 0,
                              filterMaxPrice === ""
                                ? priceRangeMax
                                : Number(filterMaxPrice),
                            ]}
                            max={priceRangeMax}
                            min={0}
                            step={50000}
                            onValueChange={(values) => {
                              setFilterMinPrice(values[0]);
                              setFilterMaxPrice(values[1]);
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="number"
                            value={filterMinPrice}
                            onBlur={handlePriceBlur}
                            onChange={(e) =>
                              setFilterMinPrice(
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                              )
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-center text-base outline-none focus:border-primary"
                            placeholder="Từ"
                          />
                          <input
                            type="number"
                            value={filterMaxPrice}
                            onBlur={handlePriceBlur}
                            onChange={(e) =>
                              setFilterMaxPrice(
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                              )
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-center text-base outline-none focus:border-primary"
                            placeholder="Đến"
                          />
                        </div>
                      </div>
                    )}

                    {activeFilterTab === "ticketType" && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-base font-bold text-slate-800">
                            Hạng vé
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            Bỏ chọn hạng vé bạn không muốn hiển thị.
                          </p>
                        </div>
                        <div className="space-y-3">
                          {ticketTypesData.map((type: any) => {
                            const typeId = type._id || type.id;
                            const isSelected =
                              selectedTicketTypes.includes(typeId);
                            return (
                              <button
                                key={typeId}
                                type="button"
                                onClick={() => toggleTicketTypeFilter(typeId)}
                                className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${isSelected ? "border-primary bg-primary/10 text-slate-900" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                              >
                                <span className="flex items-center justify-between gap-3">
                                  <span className="text-base font-semibold">
                                    {type.name}
                                  </span>
                                  <span className="text-sm font-bold">
                                    {(type.price || 0).toLocaleString("vi-VN")}{" "}
                                    đ
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {standingZones.length > 0 && (
                      <div className="mt-6 border-t border-slate-100 pt-5">
                        <div className="mb-3">
                          <p className="text-base font-bold text-slate-800">Vé GA / Standing</p>
                          <p className="text-sm text-slate-500 mt-1">Nhấn khu GA trên sơ đồ hoặc dùng nút tăng/giảm bên dưới.</p>
                        </div>
                        <div className="space-y-3">
                          {standingZones.map((zone: any) => {
                            const zoneId = zone._id;
                            const summary = zoneSummaries?.[zoneId];
                            const zoneTicketTypeId = zone.ticket_type_id || summary?.ticket_type_id || Object.keys(summary?.tiers || {})[0];
                            const ticketType = ticketTypeDictionary[zoneTicketTypeId];
                            const selectedCount = selectedCountByStandingZone[zoneId] || 0;
                            const availableCount = Object.values(summary?.tiers || {}).reduce((acc: number, tier: any) => acc + Number(tier?.count || 0), 0);
                            const isActive = activeStandingZoneId === zoneId;
                            return (
                              <div key={zoneId} className={`rounded-2xl border p-4 transition-colors ${isActive ? "border-primary bg-primary/5" : "border-slate-200 bg-white"}`}>
                                <div className="mb-3 flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">{zone.name}</p>
                                    <p className="text-xs text-slate-500">Còn {availableCount} vé · {ticketType?.name || "GA"}</p>
                                  </div>
                                  <p className="text-sm font-black text-pink-600">{Number(ticketType?.price || 0).toLocaleString("vi-VN")} đ</p>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <Button type="button" variant="outline" className="h-9 w-9 rounded-full p-0" onClick={() => updateStandingQuantity(zone, selectedCount - 1)} disabled={selectedCount <= 0}>-</Button>
                                  <div className="min-w-[96px] rounded-xl bg-slate-50 px-4 py-2 text-center text-sm font-bold text-slate-800">{selectedCount} vé</div>
                                  <Button type="button" variant="outline" className="h-9 w-9 rounded-full p-0" onClick={() => updateStandingQuantity(zone, selectedCount + 1)} disabled={selectedSeats.length >= 4 || selectedCount >= 4 || availableCount <= selectedCount}>+</Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                </aside>
              </div>

              <div className="border-t border-slate-100 bg-white px-5 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    {selectedSeats.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500">
                        Chọn ghế trên sơ đồ hoặc tăng số lượng vé GA.
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {selectedSeats.map((seat: any, idx: number) => {
                          const typeId = seat.ticket_type_id?._id || seat.ticket_type_id;
                          const typeName = ticketTypeDictionary[typeId]?.name || "Vé";
                          const price = Number(ticketTypeDictionary[typeId]?.price || 0);
                          const zoneName = zoneDictionary[seat.zone_id]?.name || "Khu vực";
                          const seatLabel = zoneDictionary[seat.zone_id]?.is_standing
                            ? `${zoneName} · Vé đứng`
                            : `Hàng ${seat.row}, ghế ${seat.seat_number || seat.col_index}`;

                          return (
                            <div
                              key={seat._id || seat.id || idx}
                              className="group flex min-w-[260px] items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-800">{seatLabel}</p>
                                  <p className="truncate text-xs text-slate-500">
                                    {typeName} · {price.toLocaleString("vi-VN")} đ
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                aria-label="Bỏ vé đã chọn"
                                onClick={() => removeSeat && removeSeat(seat._id || seat.id)}
                                className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="rounded-2xl bg-slate-50 px-5 py-3 text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Tổng cộng · {selectedSeats.length} vé
                      </p>
                      <p className="text-xl font-black text-primary">
                        {tempTotalPrice.toLocaleString("vi-VN")} đ
                      </p>
                    </div>
                    <Button
                      onClick={handleNext}
                      disabled={selectedSeats.length === 0 || holdSeatsMutation.isPending}
                      className="h-12 rounded-2xl bg-primary px-10 text-base font-bold text-white hover:bg-primary/90"
                    >
                      Tiếp tục
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="w-full min-h-[500px] bg-white rounded-xl p-8 border border-gray-100 flex flex-col items-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">
              Xác nhận thông tin vé
            </h2>
            <div className="w-full max-w-2xl bg-slate-50 rounded-xl p-6 border border-slate-200">
              <div className="flex justify-between border-b border-slate-200 pb-4 mb-4 text-sm font-bold text-slate-500 uppercase tracking-wider">
                <span>Vị trí ghế</span>
                <span>Giá vé</span>
              </div>
              <div className="space-y-4 mb-6">
                {selectedSeats.map((seat: any, index: any) => (
                  <div
                    key={index}
                    className="flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 text-primary font-bold rounded-lg flex items-center justify-center">
                        {seat.seat_number || seat.id}
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">
                          {zoneDictionary[seat.zone_id]?.is_standing
                            ? `Khu: ${zoneDictionary[seat.zone_id]?.name || "GA"} · Vé đứng`
                            : `Khu: ${zoneDictionary[seat.zone_id]?.name || "Unknown"}, Hàng: ${seat.row}, Cột: ${seat.col_index}`}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-slate-700">
                      {(
                        ticketTypeDictionary[seat.ticket_type_id]?.price || 0
                      ).toLocaleString("vi-VN")}{" "}
                      đ
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-6">
                <span className="text-lg font-bold text-slate-600">
                  Tổng thanh toán:
                </span>
                <span className="text-2xl font-bold text-orange-500 font-mono">
                  {tempTotalPrice.toLocaleString("vi-VN")} đ
                </span>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className=" w-full min-h-[500px] flex flex-col lg:flex-row gap-10 items-start py-8 ">
            <div className="bg-white flex-1 w-full flex flex-col gap-10 px-6 rounded-2xl border border-slate-200 py-8">
              <div>
                <h3 className="text-l font-medium text-blue-700 mb-6 flex items-center gap-3">
                  1. Xác nhận thông tin{" "}
                  <Edit2
                    size={18}
                    className="text-slate-400 cursor-pointer hover:text-blue-600"
                  />
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
                      onClick={() => setPaymentMethod("VNPAY")}
                      className={`w-32 h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${paymentMethod === "VNPAY" ? "border-blue-500 bg-blue-50/50 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="font-black text-blue-700 text-l tracking-tighter">
                        VNPAY
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        QR / ATM
                      </span>
                    </div>
                    <div
                      onClick={() => setPaymentMethod("MOCK")}
                      className={`w-32 h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${paymentMethod === "MOCK" ? "border-blue-500 bg-blue-50/50 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="font-bold text-slate-700 text-lg">
                        MOCK
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Test Gateway
                      </span>
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
          </div>
        );
      case 5:
        return (
          <PaymentSuccessPanel
            email={purchaserInfo.email || orderData?.billing_email}
            onBackHome={() => navigate("/")}
            onViewTickets={() => navigate("/tickets")}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`min-h-screen ${currentStep === 4 ? "bg-gray-50" : "bg-background"} relative`}
    >
      <LoadingOverlay
        isVisible={
          holdSeatsMutation.isPending ||
          createPaymentMutation.isPending ||
          releaseSeatsMutation.isPending
        }
      />
      <ErrorModal
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
      />

      {isBackConfirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900">Hủy giữ chỗ?</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Nếu quay lại bước chọn ghế, các ghế đang giữ cho đơn này sẽ được nhả ra để người khác có thể chọn.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={cancelBackToSeatMap}
                className="h-11 rounded-xl px-5 font-semibold"
              >
                Ở lại
              </Button>
              <Button
                type="button"
                onClick={confirmBackToSeatMap}
                disabled={releaseSeatsMutation.isPending}
                className="h-11 rounded-xl bg-pink-600 px-5 font-semibold text-white hover:bg-pink-700"
              >
                Hủy giữ chỗ
              </Button>
            </div>
          </div>
        </div>
      )}

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

        <div
          className={`${currentStep === 4 ? "bg-gray-50" : "bg-background"} rounded-2xl p-2`}
        >
          {renderStepContent()}
        </div>

        {/* THANH ĐIỀU HƯỚNG CHUNG BÊN DƯỚI (Chỉ hiện ở bước 3) */}
        {currentStep !== 2 && currentStep !== 5 && currentStep !== 4 && (
          <div className="mt-8 flex justify-between items-center border-t border-gray-200 pt-6 pb-10">
            {/* Nút lùi này là dự phòng ở dưới cùng màn hình */}
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={releaseSeatsMutation.isPending}
              className="text-gray-500"
            >
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
