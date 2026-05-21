import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
export const ErrorModal = ({ message, onClose }: { message: string | null, onClose: () => void }) => {
    if (!message) return null;
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm ">
            <div className="bg-white rounded-3xl p-8 flex flex-col items-center justify-center  gap-4 max-w-sm mx-4 ">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-2">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 text-center">Đã có lỗi xảy ra</h3>
                <p className="text-slate-600 text-center font-medium mb-4">{message}</p>
                <Button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-6 rounded-full font-bold text-lg">
                    Đóng
                </Button>
            </div>
        </div>
    );
};