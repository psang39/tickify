export function SeatMapLoadingState() {
  return (
    <div className="w-full h-[600px] flex flex-col items-center justify-center bg-slate-950/70 dark:bg-slate-900/80 rounded-xl border border-white/10 dark:border-white/10">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-gray-500 dark:text-slate-400 font-medium">Đang tải sơ đồ rạp...</p>
    </div>
  );
}
