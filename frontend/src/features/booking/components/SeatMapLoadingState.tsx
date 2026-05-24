export function SeatMapLoadingState() {
  return (
    <div className="w-full h-[600px] flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-gray-500 font-medium">Đang tải sơ đồ rạp...</p>
    </div>
  );
}
