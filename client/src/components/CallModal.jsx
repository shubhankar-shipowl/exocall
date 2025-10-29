import React, { useEffect, useState } from "react";
import {
  X,
  Phone,
  User,
  Package,
  DollarSign,
  Clock,
  Loader,
  MapPin,
} from "lucide-react";

const CallModal = ({ isOpen, onClose, contact, callStatus, callDuration }) => {
  const [countdown, setCountdown] = useState(0);

  // Auto-close modal when call ends
  useEffect(() => {
    // Reset countdown when modal opens
    if (isOpen) {
      setCountdown(0);
    }
  }, [isOpen]);

  // Auto-close modal when call status changes to final states
  useEffect(() => {
    if (isOpen && callStatus) {
      const finalStatuses = [
        "Completed",
        "Failed",
        "Hangup",
        "Not Called",
        "Busy",
        "No Answer",
        "Switched Off",
        "Cancelled",
      ];

      if (finalStatuses.includes(callStatus)) {
        // Start countdown from 3 seconds
        setCountdown(3);

        // Auto-close after 3 seconds for final statuses
        const timer = setTimeout(() => {
          onClose();
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, callStatus, onClose]);

  // Countdown timer for auto-close
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Early return for not open - this is safe as it's after all hooks
  if (!isOpen) return null;

  // Safety check for required props
  if (typeof onClose !== "function") {
    console.error("CallModal: onClose is not a function");
    return null;
  }

  // If contact is null or undefined, show error state
  if (!contact) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
        style={{ zIndex: 1001 }}
      >
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
            <p className="text-gray-600 mb-4">
              Contact information is missing.
            </p>
            <button
              onClick={onClose}
              className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If contact name or phone is missing, show error state
  if (!contact.name || !contact.phone) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
        style={{ zIndex: 1001 }}
      >
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
            <p className="text-gray-600 mb-4">Invalid contact data.</p>
            <button
              onClick={onClose}
              className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Format duration helper
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get status info based on call status
  const getStatusInfo = () => {
    switch (callStatus) {
      case "In Progress":
      case "Initiated":
        return {
          icon: <Loader className="w-6 h-6 text-blue-600 animate-spin" />,
          text: "Call in Progress",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
        };
      case "Completed":
        return {
          icon: <Clock className="w-6 h-6 text-green-600" />,
          text: "Call Completed",
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        };
      case "Failed":
        return {
          icon: <X className="w-6 h-6 text-red-600" />,
          text: "Call Failed",
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
        };
      case "Hangup":
        return {
          icon: <Phone className="w-6 h-6 text-orange-600" />,
          text: "Call Hung Up",
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
        };
      default:
        return {
          icon: <Phone className="w-6 h-6 text-gray-600" />,
          text: "Call Ended",
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      style={{ zIndex: 1001 }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {statusInfo.icon}
            <h2 className="text-xl font-semibold text-gray-900">
              {statusInfo.text}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Contact Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{contact.name}</h3>
                <p className="text-sm text-gray-500">Contact Name</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 font-mono">
                  {contact.phone}
                </h3>
                <p className="text-sm text-gray-500">Phone Number</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {contact.product_name || "No product"}
                </h3>
                <p className="text-sm text-gray-500">Product Name</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {contact.price ? `₹${contact.price}` : "N/A"}
                </h3>
                <p className="text-sm text-gray-500">Product Price</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 break-words">
                  {contact.address || "No address"}
                </h3>
                <p className="text-sm text-gray-500">Address</p>
              </div>
            </div>
          </div>

          {/* Call Status */}
          <div
            className={`p-4 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-medium ${statusInfo.color}`}>
                  {statusInfo.text}
                </p>
                <p className="text-sm text-gray-600">
                  {callStatus === "In Progress" || callStatus === "Initiated"
                    ? "Please wait while we connect..."
                    : callStatus === "Completed"
                    ? `Duration: ${formatDuration(
                        callDuration
                      )} - Call completed successfully${
                        countdown > 0 ? ` (Closing in ${countdown}s)` : ""
                      }`
                    : `Call ended - Status: ${callStatus}${
                        countdown > 0 ? ` (Closing in ${countdown}s)` : ""
                      }`}
                </p>
              </div>
              {callDuration > 0 && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDuration(callDuration)}
                  </p>
                  <p className="text-xs text-gray-500">Duration</p>
                </div>
              )}
            </div>
          </div>

          {/* Call Actions */}
          <div className="flex gap-3">
            {callStatus === "In Progress" || callStatus === "Initiated" ? (
              <button
                disabled
                className="flex-1 bg-gray-100 text-gray-400 py-3 px-4 rounded-lg font-medium cursor-not-allowed"
              >
                Call in Progress...
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                {countdown > 0 ? `Close Modal (${countdown}s)` : "Close Modal"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallModal;
