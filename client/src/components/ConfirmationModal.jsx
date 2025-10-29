import React from "react";
import { AlertTriangle, X, CheckCircle } from "lucide-react";

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning", // warning, danger, info
  isLoading = false,
  confirmButtonColor = "#3b82f6",
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "danger":
        return (
          <X style={{ width: "24px", height: "24px", color: "#ef4444" }} />
        );
      case "info":
        return (
          <CheckCircle
            style={{ width: "24px", height: "24px", color: "#3b82f6" }}
          />
        );
      default:
        return (
          <AlertTriangle
            style={{ width: "24px", height: "24px", color: "#f59e0b" }}
          />
        );
    }
  };

  const getIconBgColor = () => {
    switch (type) {
      case "danger":
        return "#fee2e2";
      case "info":
        return "#eff6ff";
      default:
        return "#fef3c7";
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          width: "100%",
          maxWidth: "400px",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              padding: "8px",
              borderRadius: "8px",
              backgroundColor: getIconBgColor(),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {getIcon()}
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#111827",
                margin: 0,
              }}
            >
              {title}
            </h3>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "4px",
                color: "#6b7280",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "transparent";
              }}
            >
              <X style={{ width: "20px", height: "20px" }} />
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "0 24px 20px" }}>
          <p
            style={{
              fontSize: "14px",
              color: "#6b7280",
              margin: 0,
              lineHeight: "1.5",
            }}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div
          style={{
            padding: "16px 24px 24px",
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f3f4f6",
              color: "#374151",
              border: "none",
              borderRadius: "8px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              backgroundColor: isLoading ? "#9ca3af" : confirmButtonColor,
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor =
                  type === "danger"
                    ? "#dc2626"
                    : type === "info"
                    ? "#2563eb"
                    : "#d97706";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = confirmButtonColor;
              }
            }}
          >
            {isLoading && (
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid transparent",
                  borderTop: "2px solid white",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
