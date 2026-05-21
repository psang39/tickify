import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
export const LoadingOverlay = ({ isVisible }: { isVisible: boolean }) => {
    if (!isVisible) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
            <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center shadow-2xl gap-6 min-w-[350px] animate-in fade-in zoom-in duration-200">
                <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Vui lòng đợi trong giây lát...</h3>
                <RefreshCw size={36} className="text-slate-600 animate-spin" />
            </div>
        </div>
    );
};