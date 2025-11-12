import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Download,
  Filter,
  Calendar,
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  Phone,
  CheckCircle,
  Clock,
  X,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { toast } from "react-toastify";

const Reports = () => {
  const { user, token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [callLogs, setCallLogs] = useState([]);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    status: "all",
    store: "all",
    page: 1,
    limit: 1000, // Increased default limit to show more historical data
  });
  const [pagination, setPagination] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [chartType, setChartType] = useState("bar"); // bar, pie, line
  const [availableStores, setAvailableStores] = useState([]);

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append("startDate", filters.startDate);
      if (filters.endDate) queryParams.append("endDate", filters.endDate);
      if (filters.status !== "all")
        queryParams.append("status", filters.status);
      if (filters.store !== "all")
        queryParams.append("store", filters.store);

      const response = await fetch(`/api/reports/statistics?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStatistics(data.statistics);
      } else {
        console.error(
          "Failed to fetch statistics:",
          response.status,
          response.statusText
        );
        // Set default empty statistics instead of showing error
        setStatistics({
          totalCalls: 0,
          callsByStatus: [],
          successRate: 0,
          avgDuration: 0,
          callsByDay: [],
          topAgents: [],
        });
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
      // Set default empty statistics instead of showing error
      setStatistics({
        totalCalls: 0,
        callsByStatus: [],
        successRate: 0,
        avgDuration: 0,
        callsByDay: [],
        topAgents: [],
      });
    }
  };

  // Fetch call logs
  const fetchCallLogs = async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`/api/reports/logs?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCallLogs(data.data.callLogs);
        setPagination(data.data.pagination);
        
        // Extract unique stores from call logs
        const stores = [
          ...new Set(
            data.data.callLogs
              .map((log) => log.contact?.store)
              .filter((store) => store && store.trim() !== "")
          ),
        ].sort();
        setAvailableStores(stores);
      } else {
        console.error(
          "Failed to fetch call logs:",
          response.status,
          response.statusText
        );
        // Don't show error toast for empty results, just set empty state
        setCallLogs([]);
        setPagination({});
      }
    } catch (error) {
      console.error("Error fetching call logs:", error);
      // Don't show error toast for network issues, just set empty state
      setCallLogs([]);
      setPagination({});
    }
  };

  // Export data
  const handleExport = async (format = "xlsx") => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append("startDate", filters.startDate);
      if (filters.endDate) queryParams.append("endDate", filters.endDate);
      if (filters.status !== "all")
        queryParams.append("status", filters.status);
      if (filters.store !== "all")
        queryParams.append("store", filters.store);
      queryParams.append("format", format);

      const response = await fetch(`/api/reports/export?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `call_logs_${
          new Date().toISOString().split("T")[0]
        }.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Exported successfully as ${format.toUpperCase()}`);
      } else {
        toast.error("Failed to export data");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Network error. Please try again.");
    }
  };

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchStatistics(), fetchCallLogs()]);
      setIsLoading(false);
    };
    loadData();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      status: "all",
      store: "all",
      page: 1,
      limit: 1000, // Increased default limit to show more historical data
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      "Not Called": { bg: "#fef3c7", text: "#92400e", border: "#f59e0b" },
      "In Progress": { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
      Completed: { bg: "#ede9fe", text: "#5b21b6", border: "#8b5cf6" },
      Failed: { bg: "#fee2e2", text: "#991b1b", border: "#ef4444" },
    };

    const style = styles[status] || styles["Not Called"];

    return (
      <span
        style={{
          backgroundColor: style.bg,
          color: style.text,
          border: `1px solid ${style.border}`,
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "500",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div
        style={{
          padding: "24px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <RefreshCw
            style={{
              width: "24px",
              height: "24px",
              animation: "spin 1s linear infinite",
            }}
          />
          <span style={{ fontSize: "16px", color: "#6b7280" }}>
            Loading reports...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "30px",
            fontWeight: "bold",
            color: "#111827",
            margin: "0 0 8px 0",
          }}
        >
          Reports & Analytics
        </h1>
        <p style={{ color: "#6b7280", margin: 0, fontSize: "16px" }}>
          Comprehensive call analytics and export functionality
        </p>
      </div>

      {/* Filters and Actions */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow:
            "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#111827",
              margin: 0,
            }}
          >
            Filters & Export
          </h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                backgroundColor: "#f3f4f6",
                color: "#374151",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              <Filter style={{ width: "16px", height: "16px" }} />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </button>
            <button
              onClick={() => handleExport("xlsx")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              <Download style={{ width: "16px", height: "16px" }} />
              Export Excel
            </button>
            <button
              onClick={() => handleExport("csv")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              <Download style={{ width: "16px", height: "16px" }} />
              Export CSV
            </button>
          </div>
        </div>

        {showFilters && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              padding: "20px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
            }}
          >
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
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
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
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
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
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="Not Called">Not Called</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Failed">Failed</option>
              </select>
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
                Store
              </label>
              <select
                value={filters.store}
                onChange={(e) => handleFilterChange("store", e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                }}
              >
                <option value="all">All Stores</option>
                {availableStores.map((store) => (
                  <option key={store} value={store}>
                    {store}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button
                onClick={clearFilters}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div>
          {statistics.totalCalls === 0 ? (
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                boxShadow:
                  "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                padding: "40px",
                textAlign: "center",
                marginBottom: "32px",
              }}
            >
              <div
                style={{
                  fontSize: "48px",
                  color: "#d1d5db",
                  marginBottom: "16px",
                }}
              >
                📊
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#374151",
                  margin: "0 0 8px 0",
                }}
              >
                No Call Data Available
              </h3>
              <p style={{ color: "#6b7280", margin: "0 0 16px 0" }}>
                Statistics will appear here once you start making calls to your
                contacts.
              </p>
              <p style={{ color: "#9ca3af", fontSize: "14px", margin: 0 }}>
                Go to the Call Management page to start making calls.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "20px",
                marginBottom: "32px",
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  boxShadow:
                    "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                  padding: "20px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      padding: "10px",
                      backgroundColor: "#3b82f6",
                      borderRadius: "8px",
                    }}
                  >
                    <Phone
                      style={{ width: "20px", height: "20px", color: "white" }}
                    />
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#6b7280",
                        margin: "0 0 4px 0",
                      }}
                    >
                      Total Calls
                    </p>
                    <p
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "#111827",
                        margin: 0,
                      }}
                    >
                      {statistics.totalCalls}
                    </p>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  boxShadow:
                    "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                  padding: "20px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      padding: "10px",
                      backgroundColor: "#10b981",
                      borderRadius: "8px",
                    }}
                  >
                    <CheckCircle
                      style={{ width: "20px", height: "20px", color: "white" }}
                    />
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#6b7280",
                        margin: "0 0 4px 0",
                      }}
                    >
                      Success Rate
                    </p>
                    <p
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "#111827",
                        margin: 0,
                      }}
                    >
                      {statistics.successRate}%
                    </p>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  boxShadow:
                    "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                  padding: "20px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      padding: "10px",
                      backgroundColor: "#f59e0b",
                      borderRadius: "8px",
                    }}
                  >
                    <Clock
                      style={{ width: "20px", height: "20px", color: "white" }}
                    />
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#6b7280",
                        margin: "0 0 4px 0",
                      }}
                    >
                      Avg Duration
                    </p>
                    <p
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "#111827",
                        margin: 0,
                      }}
                    >
                      {formatDuration(statistics.avgDuration)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      {statistics && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "24px",
            marginBottom: "32px",
          }}
        >
          {/* Status Distribution Chart */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              boxShadow:
                "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: 0,
                }}
              >
                Call Status Distribution
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setChartType("bar")}
                  style={{
                    padding: "6px 12px",
                    backgroundColor:
                      chartType === "bar" ? "#3b82f6" : "#f3f4f6",
                    color: chartType === "bar" ? "white" : "#374151",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  <BarChart3 style={{ width: "14px", height: "14px" }} />
                </button>
                <button
                  onClick={() => setChartType("pie")}
                  style={{
                    padding: "6px 12px",
                    backgroundColor:
                      chartType === "pie" ? "#3b82f6" : "#f3f4f6",
                    color: chartType === "pie" ? "white" : "#374151",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  <PieChart style={{ width: "14px", height: "14px" }} />
                </button>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              {chartType === "bar" ? (
                <BarChart data={statistics.callsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              ) : (
                <RechartsPieChart>
                  <Pie
                    data={statistics.callsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {statistics.callsByStatus.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"][
                            index % 4
                          ]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Calls by Day Chart */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              boxShadow:
                "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
              padding: "24px",
            }}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#111827",
                margin: "0 0 20px 0",
              }}
            >
              Calls by Day
            </h3>

            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={statistics.callsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Call Logs Table */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow:
            "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
          padding: "24px",
        }}
      >
        <h3
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#111827",
            margin: "0 0 20px 0",
          }}
        >
          Call Logs
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "12px 8px",
                    fontWeight: "600",
                    color: "#374151",
                  }}
                >
                  Contact
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "12px 8px",
                    fontWeight: "600",
                    color: "#374151",
                  }}
                >
                  Attempt
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "12px 8px",
                    fontWeight: "600",
                    color: "#374151",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "12px 8px",
                    fontWeight: "600",
                    color: "#374151",
                  }}
                >
                  Duration
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "12px 8px",
                    fontWeight: "600",
                    color: "#374151",
                  }}
                >
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {callLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    style={{
                      textAlign: "center",
                      padding: "24px",
                      color: "#6b7280",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div style={{ fontSize: "48px", color: "#d1d5db" }}>
                        📞
                      </div>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: "500",
                          color: "#374151",
                        }}
                      >
                        No call logs found
                      </div>
                      <div style={{ fontSize: "14px", color: "#6b7280" }}>
                        Call logs will appear here once you start making calls
                        to contacts
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                callLogs.map((log) => (
                  <tr
                    key={log.id}
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
                    <td style={{ padding: "12px 8px" }}>
                      <div>
                        <p
                          style={{
                            fontWeight: "500",
                            color: "#111827",
                            margin: "0 0 4px 0",
                          }}
                        >
                          {log.contact?.name || "Unknown"}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            margin: 0,
                          }}
                        >
                          {log.contact?.phone || "N/A"}
                        </p>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      #{log.attempt_no}
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "center" }}>
                      {getStatusBadge(log.status)}
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      {formatDuration(log.duration)}
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "20px",
            }}
          >
            <button
              onClick={() =>
                handleFilterChange("page", pagination.currentPage - 1)
              }
              disabled={!pagination.hasPrevPage}
              style={{
                padding: "8px 12px",
                backgroundColor: pagination.hasPrevPage ? "#3b82f6" : "#9ca3af",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: pagination.hasPrevPage ? "pointer" : "not-allowed",
                fontSize: "14px",
              }}
            >
              Previous
            </button>

            <span style={{ color: "#6b7280", fontSize: "14px" }}>
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>

            <button
              onClick={() =>
                handleFilterChange("page", pagination.currentPage + 1)
              }
              disabled={!pagination.hasNextPage}
              style={{
                padding: "8px 12px",
                backgroundColor: pagination.hasNextPage ? "#3b82f6" : "#9ca3af",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: pagination.hasNextPage ? "pointer" : "not-allowed",
                fontSize: "14px",
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
