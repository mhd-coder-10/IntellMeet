// Reusable Confirmation Modal Dialog
// Provides a modern, accessible confirmation dialog replacing native window.confirm()

import React from "react";
import { AlertTriangle, AlertCircle, Info, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const iconVariants = {
    danger: (
      <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mx-auto shadow-xs">
        <AlertTriangle className="w-6 h-6" />
      </div>
    ),
    warning: (
      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mx-auto shadow-xs">
        <AlertCircle className="w-6 h-6" />
      </div>
    ),
    info: (
      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto shadow-xs">
        <Info className="w-6 h-6" />
      </div>
    ),
  };

  const confirmBtnVariants = {
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-xs",
    warning: "bg-amber-600 hover:bg-amber-700 text-white shadow-xs",
    info: "bg-blue-600 hover:bg-blue-700 text-white shadow-xs",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="relative w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {iconVariants[variant]}

        <div className="text-center space-y-2">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {title}
          </h3>
          <div className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
            {description}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-xl border-slate-200 text-slate-700 text-xs sm:text-sm h-10 hover:bg-slate-50"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 rounded-xl text-xs sm:text-sm font-semibold h-10 ${confirmBtnVariants[variant]}`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
