import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  X,
  Users,
  Clock,
  ArrowRight,
  Trash2,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../contexts/AuthContext";

const UploadContacts = () => {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDateDeleteModal, setShowDateDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState("all"); // "all" or "date"
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [uploadDate, setUploadDate] = useState("");

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setFile(file);
      parseExcelFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  const parseExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setParsedData(jsonData);
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast.error("Error parsing Excel file. Please check the file format.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const uploadToServer = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("excelFile", file);
    if (uploadDate) {
      formData.append("uploadDate", uploadDate);
    }

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStats(result);
        toast.success(result.message);
        setFile(null);
        setParsedData([]);
      } else {
        toast.error(result.error || "Upload failed");
        console.error("Upload error:", result);
      }
    } catch (error) {
      console.error("Upload error:", error);
      if (
        error.name === "TypeError" &&
        error.message.includes("Failed to fetch")
      ) {
        toast.error(
          "Cannot connect to server. Please check if the backend is running."
        );
      } else {
        toast.error("Network error. Please try again.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsedData([]);
    setUploadStats(null);
  };

  const deleteAllContacts = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/upload/clear", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: true }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        setUploadStats(null);
        setShowDeleteModal(false);
      } else {
        toast.error(result.error || "Failed to delete contacts");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteContactsByDate = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/upload/clear-by-date", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          confirm: true,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        setUploadStats(null);
        setShowDateDeleteModal(false);
        setDateRange({ startDate: "", endDate: "" });
      } else {
        toast.error(result.error || "Failed to delete contacts");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (type) => {
    setDeleteType(type);
    if (type === "all") {
      setShowDeleteModal(true);
    } else {
      setShowDateDeleteModal(true);
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return "N/A";
    const cleaned = phone.toString().replace(/\D/g, "");
    return cleaned.length >= 10 ? cleaned : phone.toString();
  };

  const formatMessage = (row) => {
    const orderNumber = row["Order Number"];
    const productName = row["Product Name *"] || row["Product Name"];
    const productQty = row["Product Qty"];
    const productValue = row["Product Value"];
    const location = row["location"];

    let message = `Order: ${orderNumber || "N/A"}`;
    if (productName) message += ` | Product: ${productName}`;
    if (productQty) message += ` | Qty: ${productQty}`;
    if (productValue) message += ` | Value: ₹${productValue}`;
    if (location) message += ` | Location: ${location}`;

    return message;
  };

  return (
    <div style={{ padding: "24px" }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "30px",
            fontWeight: "bold",
            color: "#111827",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Upload style={{ width: "32px", height: "32px" }} />
          Upload Contacts
        </h1>
        <p
          style={{
            color: "#6b7280",
            margin: "8px 0 0 0",
            fontSize: "16px",
          }}
        >
          Import contact data from Excel files (.xlsx, .xls)
        </p>
      </div>

      {/* Upload Area */}
      <div style={{ marginBottom: "32px" }}>
        <div
          {...getRootProps()}
          style={{
            border: "2px dashed",
            borderColor: isDragActive ? "#3b82f6" : "#d1d5db",
            borderRadius: "12px",
            padding: "48px 24px",
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: isDragActive ? "#eff6ff" : "#f9fafb",
            transition: "all 0.2s",
            position: "relative",
          }}
        >
          <input {...getInputProps()} />
          {file ? (
            <div>
              <FileSpreadsheet
                style={{
                  width: "48px",
                  height: "48px",
                  color: "#10b981",
                  margin: "0 auto 16px",
                }}
              />
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: "0 0 8px 0",
                }}
              >
                {file.name}
              </h3>
              <p style={{ color: "#6b7280", margin: "0 0 16px 0" }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                style={{
                  backgroundColor: "#ef4444",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  margin: "0 auto",
                }}
              >
                <X style={{ width: "16px", height: "16px" }} />
                Remove File
              </button>
            </div>
          ) : (
            <div>
              <Upload
                style={{
                  width: "48px",
                  height: "48px",
                  color: "#6b7280",
                  margin: "0 auto 16px",
                }}
              />
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: "0 0 8px 0",
                }}
              >
                {isDragActive
                  ? "Drop the Excel file here"
                  : "Drag & drop Excel file here"}
              </h3>
              <p style={{ color: "#6b7280", margin: "0 0 16px 0" }}>
                or click to browse files
              </p>
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  backgroundColor: "#f3f4f6",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  display: "inline-block",
                }}
              >
                Supports .xlsx and .xls files (max 10MB)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Date Selection */}
      <div
        style={{
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <Calendar
            style={{ width: "20px", height: "20px", color: "#6b7280" }}
          />
          <h3
            style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#111827",
              margin: 0,
            }}
          >
            Upload Date (Optional)
          </h3>
        </div>
        <p
          style={{
            color: "#6b7280",
            margin: "0 0 16px 0",
            fontSize: "14px",
          }}
        >
          Select a date for this upload. Leave empty to use the current date.
        </p>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <input
              type="date"
              value={uploadDate}
              onChange={(e) => setUploadDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
                backgroundColor: "white",
              }}
            />
          </div>
          {uploadDate && (
            <button
              onClick={() => setUploadDate("")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#f3f4f6",
                color: "#374151",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <X style={{ width: "16px", height: "16px" }} />
              Clear
            </button>
          )}
        </div>
        {uploadDate && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              backgroundColor: "#dbeafe",
              border: "1px solid #bfdbfe",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#1e40af",
            }}
          >
            📅 Upload will be dated: {new Date(uploadDate).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Upload Button */}
      {parsedData.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <button
            onClick={clearFile}
            style={{
              backgroundColor: "#6b7280",
              color: "white",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <X style={{ width: "16px", height: "16px" }} />
            Cancel
          </button>
          <button
            onClick={uploadToServer}
            disabled={isUploading}
            style={{
              backgroundColor: isUploading ? "#9ca3af" : "#3b82f6",
              color: "white",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: isUploading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isUploading ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #ffffff",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Uploading...
              </>
            ) : (
              <>
                <ArrowRight style={{ width: "16px", height: "16px" }} />
                Upload to Server
              </>
            )}
          </button>
        </div>
      )}

      {/* Upload Stats */}
      {uploadStats && (
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: "#111827",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircle
                style={{ width: "24px", height: "24px", color: "#10b981" }}
              />
              Upload Successful!
            </h3>
          </div>

          <div
            style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "20px",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    marginBottom: "8px",
                  }}
                >
                  Total Rows
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#111827",
                  }}
                >
                  {uploadStats.totalRows}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    marginBottom: "8px",
                  }}
                >
                  Valid Contacts
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#10b981",
                  }}
                >
                  {uploadStats.validContacts}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    marginBottom: "8px",
                  }}
                >
                  Inserted
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#3b82f6",
                  }}
                >
                  {uploadStats.insertedContacts}
                </div>
              </div>
            </div>

            {uploadStats.errors && uploadStats.errors.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#374151",
                    margin: "0 0 8px 0",
                  }}
                >
                  Errors (showing first 10):
                </h4>
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    padding: "12px",
                    fontSize: "12px",
                    color: "#991b1b",
                    maxHeight: "120px",
                    overflowY: "auto",
                  }}
                >
                  {uploadStats.errors.map((error, index) => (
                    <div key={index} style={{ marginBottom: "4px" }}>
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Section */}
      <div style={{ marginBottom: "32px" }}>
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <AlertTriangle
              style={{ width: "24px", height: "24px", color: "#dc2626" }}
            />
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#dc2626",
                margin: 0,
              }}
            >
              Delete Uploaded Data
            </h3>
          </div>
          <p
            style={{
              color: "#7f1d1d",
              margin: "0 0 20px 0",
              fontSize: "14px",
            }}
          >
            Remove uploaded contacts from the database. This action cannot be
            undone.
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => openDeleteModal("all")}
              style={{
                backgroundColor: "#dc2626",
                color: "white",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#b91c1c")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "#dc2626")}
            >
              <Trash2 style={{ width: "16px", height: "16px" }} />
              Delete All Contacts
            </button>
            <button
              onClick={() => openDeleteModal("date")}
              style={{
                backgroundColor: "#f59e0b",
                color: "white",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#d97706")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "#f59e0b")}
            >
              <Calendar style={{ width: "16px", height: "16px" }} />
              Delete by Date Range
            </button>
          </div>
        </div>
      </div>

      {/* Delete All Confirmation Modal */}
      {showDeleteModal && (
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
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <AlertTriangle
                style={{ width: "24px", height: "24px", color: "#dc2626" }}
              />
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: 0,
                }}
              >
                Delete All Contacts
              </h3>
            </div>
            <p
              style={{
                color: "#6b7280",
                margin: "0 0 24px 0",
                lineHeight: "1.5",
              }}
            >
              Are you sure you want to delete ALL uploaded contacts? This action
              cannot be undone and will remove all contact data from the
              database.
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Cancel
              </button>
              <button
                onClick={deleteAllContacts}
                disabled={isDeleting}
                style={{
                  backgroundColor: isDeleting ? "#9ca3af" : "#dc2626",
                  color: "white",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {isDeleting ? "Deleting..." : "Delete All"}
                {isDeleting && (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete by Date Confirmation Modal */}
      {showDateDeleteModal && (
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
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <Calendar
                style={{ width: "24px", height: "24px", color: "#f59e0b" }}
              />
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: 0,
                }}
              >
                Delete Contacts by Date Range
              </h3>
            </div>
            <p
              style={{
                color: "#6b7280",
                margin: "0 0 20px 0",
                lineHeight: "1.5",
              }}
            >
              Select a date range to delete contacts uploaded within that
              period. This action cannot be undone.
            </p>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, startDate: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, endDate: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowDateDeleteModal(false);
                  setDateRange({ startDate: "", endDate: "" });
                }}
                style={{
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Cancel
              </button>
              <button
                onClick={deleteContactsByDate}
                disabled={
                  isDeleting || !dateRange.startDate || !dateRange.endDate
                }
                style={{
                  backgroundColor:
                    isDeleting || !dateRange.startDate || !dateRange.endDate
                      ? "#9ca3af"
                      : "#f59e0b",
                  color: "white",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  cursor:
                    isDeleting || !dateRange.startDate || !dateRange.endDate
                      ? "not-allowed"
                      : "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {isDeleting ? "Deleting..." : "Delete by Date"}
                {isDeleting && (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default UploadContacts;
