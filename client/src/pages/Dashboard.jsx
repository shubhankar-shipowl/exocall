import {
  Phone,
  Users,
  Clock,
  Play,
  Loader,
  RotateCcw,
  Volume2,
  BarChart3,
  X,
  Eye,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import CallDetailModal from "../components/CallDetailModal";
import ConfirmationModal from "../components/ConfirmationModal";
import { EmptyStates } from "../components/EmptyState";
import {
  StatsCardSkeleton,
  TableSkeleton,
} from "../components/LoadingSkeleton";

const Dashboard = () => {
  const { token } = useAuth();
  const [callStats, setCallStats] = useState({
    totalContacts: 0,
    notCalled: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    averageDuration: 0,
  });
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showChart, setShowChart] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dailyTrends, setDailyTrends] = useState([]);
  const [hourlyTrends, setHourlyTrends] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState({
    contacts: { total: 0, byStatus: [] },
    calls: { total: 0, completed: 0, today: 0, successRate: 0, avgDuration: 0 },
  });

  // Confirmation modal states
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    type: "warning",
    title: "",
    message: "",
    onConfirm: null,
    confirmText: "Confirm",
    confirmButtonColor: "#3b82f6",
  });

  // Fetch call statistics
  const fetchCallStats = async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/call/stats?t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCallStats({
          totalContacts: data.statusBreakdown.reduce(
            (sum, item) => sum + parseInt(item.count),
            0
          ),
          notCalled:
            data.statusBreakdown.find((item) => item.status === "Not Called")
              ?.count || 0,
          inProgress:
            data.statusBreakdown.find((item) => item.status === "In Progress")
              ?.count || 0,
          completed:
            data.statusBreakdown.find((item) => item.status === "Completed")
              ?.count || 0,
          failed:
            data.statusBreakdown.find((item) => item.status === "Failed")
              ?.count || 0,
          averageDuration: dashboardSummary.calls.avgDuration || 0,
        });
      } else {
        console.error(
          "Failed to fetch call stats:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Error fetching call stats:", error);
    }
  };

  // Fetch contacts data
  const fetchContacts = async () => {
    try {
      const timestamp = new Date().getTime();
      console.log(
        "🔄 [Frontend Dashboard] - Fetching contacts from /api/contacts"
      );
      console.log(
        "[Frontend Dashboard] Request URL:",
        `/api/contacts?t=${timestamp}`
      );

      const response = await fetch(`/api/contacts?t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("[Frontend Dashboard] Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log(
          "✅ [Frontend Dashboard] - Successfully received contacts:",
          {
            count: data.length,
            sampleContact:
              data.length > 0
                ? {
                    id: data[0].id,
                    name: data[0].name,
                    product_name: data[0].product_name,
                    price: data[0].price,
                  }
                : "No contacts",
            allContacts: data,
          }
        );
        setContacts(data);
      } else {
        console.error(
          "Failed to fetch contacts:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  };

  // Fetch dashboard summary data
  const fetchDashboardSummary = async () => {
    try {
      const response = await fetch("/api/reports/summary", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📊 Dashboard Summary Data:", data.summary);
        console.log("📊 Avg Duration:", data.summary?.calls?.avgDuration);
        setDashboardSummary(data.summary);
      } else {
        console.error("Failed to fetch dashboard summary:", response.status);
      }
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
    }
  };

  // Fetch daily trends data
  const fetchDailyTrends = async () => {
    try {
      const response = await fetch("/api/reports/daily-trends?days=7", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDailyTrends(data.data);
      } else {
        console.error("Failed to fetch daily trends:", response.status);
      }
    } catch (error) {
      console.error("Error fetching daily trends:", error);
    }
  };

  // Fetch hourly trends data
  const fetchHourlyTrends = async () => {
    try {
      const response = await fetch("/api/reports/hourly-trends", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHourlyTrends(data.data);
      } else {
        console.error("Failed to fetch hourly trends:", response.status);
      }
    } catch (error) {
      console.error("Error fetching hourly trends:", error);
    }
  };

  // Retry failed call with confirmation
  const handleRetryCall = (contactId, contactName) => {
    setConfirmationModal({
      isOpen: true,
      type: "warning",
      title: "Retry Call",
      message: `Are you sure you want to retry the call for ${contactName}? This will reset the call status and attempt again.`,
      onConfirm: () => confirmRetryCall(contactId),
      confirmText: "Retry",
      confirmButtonColor: "#f59e0b",
    });
  };

  const confirmRetryCall = async (contactId) => {
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "Not Called",
          attempts: 0,
          exotel_call_sid: null,
        }),
      });

      if (response.ok) {
        toast.success("Contact reset for retry");
        await Promise.all([fetchCallStats(), fetchContacts()]);
      } else {
        toast.error("Failed to reset contact");
      }
    } catch (error) {
      console.error("Error retrying call:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const openContactModal = (contactId) => {
    setSelectedContactId(contactId);
    setIsModalOpen(true);
  };

  const closeContactModal = () => {
    setIsModalOpen(false);
    setSelectedContactId(null);
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Force refresh with cache busting
        const timestamp = new Date().getTime();
        console.log("🔄 Loading fresh data with timestamp:", timestamp);

        await Promise.all([
          fetchCallStats(),
          fetchContacts(),
          fetchDashboardSummary(),
          fetchDailyTrends(),
          fetchHourlyTrends(),
        ]);

        console.log("✅ Fresh data loaded successfully");
      } catch (error) {
        console.error("Dashboard: Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  // Chart data for status distribution - ensure all categories are visible
  const statusChartData = [
    {
      name: "Not Called",
      value:
        dashboardSummary.contacts.byStatus.find(
          (s) => s.status === "Not Called"
        )?.count || 0,
      color: "#f59e0b",
    },
    {
      name: "In Progress",
      value:
        dashboardSummary.contacts.byStatus.find(
          (s) => s.status === "In Progress"
        )?.count || 0,
      color: "#10b981",
    },
    {
      name: "Completed",
      value:
        dashboardSummary.contacts.byStatus.find((s) => s.status === "Completed")
          ?.count || 0,
      color: "#8b5cf6",
    },
    {
      name: "Failed",
      value:
        dashboardSummary.contacts.byStatus.find((s) => s.status === "Failed")
          ?.count || 0,
      color: "#ef4444",
    },
  ].map((item) => ({
    ...item,
    // Ensure minimum value of 1 for visibility, but keep original value for tooltip
    value: Math.max(item.value, 1),
    originalValue: item.value, // Store original value for display
  }));

  const stats = [
    {
      title: "Total Contacts",
      value: dashboardSummary.contacts.total.toString(),
      icon: Users,
      color: "#3b82f6",
    },
    {
      title: "Not Called",
      value:
        dashboardSummary.contacts.byStatus
          .find((s) => s.status === "Not Called")
          ?.count?.toString() || "0",
      icon: Phone,
      color: "#f59e0b",
    },
    {
      title: "In Progress",
      value:
        dashboardSummary.contacts.byStatus
          .find((s) => s.status === "In Progress")
          ?.count?.toString() || "0",
      icon: Clock,
      color: "#10b981",
    },
    {
      title: "Completed",
      value:
        dashboardSummary.contacts.byStatus
          .find((s) => s.status === "Completed")
          ?.count?.toString() || "0",
      icon: CheckCircle,
      color: "#8b5cf6",
    },
    {
      title: "Failed",
      value:
        dashboardSummary.contacts.byStatus
          .find((s) => s.status === "Failed")
          ?.count?.toString() || "0",
      icon: X,
      color: "#ef4444",
    },
    {
      title: "Avg Duration",
      value: `${Math.round(dashboardSummary.calls.avgDuration)}s`,
      icon: TrendingUp,
      color: "#06b6d4",
    },
  ];

  // Status badge component
  const StatusBadge = ({ status }) => {
    const getStatusStyle = (status) => {
      switch (status) {
        case "Not Called":
          return { bg: "#fef3c7", text: "#92400e", border: "#f59e0b" };
        case "In Progress":
          return { bg: "#d1fae5", text: "#065f46", border: "#10b981" };
        case "Completed":
          return { bg: "#ede9fe", text: "#5b21b6", border: "#8b5cf6" };
        case "Failed":
          return { bg: "#fee2e2", text: "#991b1b", border: "#ef4444" };
        default:
          return { bg: "#f3f4f6", text: "#374151", border: "#6b7280" };
      }
    };

    const style = getStatusStyle(status);
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

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Play recording
  const playRecording = (recordingUrl) => {
    if (!recordingUrl) {
      toast.error("No recording available");
      return;
    }
    const audio = new Audio(recordingUrl);
    audio.play().catch(() => {
      toast.error("Failed to play recording");
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: "24px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "30px",
              fontWeight: "bold",
              color: "#111827",
              margin: 0,
            }}
          >
            Dashboard
          </h1>
          <p
            style={{
              color: "#6b7280",
              margin: "8px 0 0 0",
              fontSize: "16px",
            }}
          >
            Analytics and call tracking overview
          </p>
        </div>

        {/* Loading skeleton for stats cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <StatsCardSkeleton key={index} />
          ))}
        </div>

        {/* Loading skeleton for table */}
        <TableSkeleton rows={10} columns={8} />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "30px",
            fontWeight: "bold",
            color: "#111827",
            margin: 0,
          }}
        >
          Dashboard
        </h1>
        <p
          style={{
            color: "#6b7280",
            margin: "8px 0 0 0",
            fontSize: "16px",
          }}
        >
          Analytics and call tracking overview
        </p>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                boxShadow:
                  "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                padding: "20px",
                display: "flex",
                alignItems: "center",
                transition: "transform 0.2s, box-shadow 0.2s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)";
              }}
            >
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  backgroundColor: stat.color,
                  marginRight: "16px",
                }}
              >
                <Icon
                  style={{ width: "24px", height: "24px", color: "white" }}
                />
              </div>
              <div>
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#6b7280",
                    margin: 0,
                  }}
                >
                  {stat.title}
                </p>
                <p
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#111827",
                    margin: "4px 0 0 0",
                  }}
                >
                  {stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "24px",
          marginBottom: "24px",
        }}
      >
        {/* Status Distribution Chart */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow:
              "0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)",
            padding: "28px",
            border: "1px solid #e5e7eb",
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
                fontWeight: "700",
                color: "#111827",
                margin: 0,
              }}
            >
              Call Status Distribution
            </h3>
            <button
              onClick={() => setShowChart(!showChart)}
              style={{
                background: "none",
                border: "1px solid #e5e7eb",
                cursor: "pointer",
                padding: "8px",
                borderRadius: "8px",
                color: "#6b7280",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "#f9fafb";
                e.target.style.borderColor = "#d1d5db";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "none";
                e.target.style.borderColor = "#e5e7eb";
              }}
            >
              <BarChart3 style={{ width: "20px", height: "20px" }} />
            </button>
          </div>
          {showChart ? (
            <>
              <ResponsiveContainer width="100%" height={340}>
                <PieChart>
                  {/* Center label showing total contacts */}
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontSize: "24px",
                      fontWeight: "700",
                      fill: "#111827",
                    }}
                  >
                    {callStats.notCalled +
                      callStats.inProgress +
                      callStats.completed +
                      callStats.failed}
                  </text>
                  <text
                    x="50%"
                    y="55%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontSize: "14px",
                      fontWeight: "500",
                      fill: "#6b7280",
                    }}
                  >
                    Total Contacts
                  </text>
                  <defs>
                    {/* Primary blue gradients with #3B82F6 */}
                    <linearGradient
                      id="colorNotCalled"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient
                      id="colorInProgress"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient
                      id="colorCompleted"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient
                      id="colorFailed"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity="1" />
                    </linearGradient>
                    {/* Sharp, crisp rendering */}
                  </defs>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, payload }) => {
                      const originalValue = payload?.originalValue || 0;
                      const total =
                        callStats.notCalled +
                        callStats.inProgress +
                        callStats.completed +
                        callStats.failed;

                      if (originalValue === 0) return "";

                      const actualPercent =
                        total > 0 ? (originalValue / total) * 100 : 0;

                      // Show both percentage and count for clarity
                      if (actualPercent > 10) {
                        return `${name}\n${actualPercent.toFixed(0)}%`;
                      } else if (originalValue > 0) {
                        return `${originalValue}`;
                      }
                      return "";
                    }}
                    outerRadius={120}
                    innerRadius={55}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={3}
                  >
                    {statusChartData.map((entry, index) => {
                      const gradientId =
                        entry.name === "Not Called"
                          ? "colorNotCalled"
                          : entry.name === "In Progress"
                          ? "colorInProgress"
                          : entry.name === "Completed"
                          ? "colorCompleted"
                          : "colorFailed";

                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.originalValue > 0
                              ? `url(#${gradientId})`
                              : "#f3f4f6"
                          }
                          stroke={
                            entry.originalValue > 0 ? "#ffffff" : "#e5e7eb"
                          }
                          strokeWidth={entry.originalValue > 0 ? 3 : 1}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "12px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                      fontSize: "14px",
                    }}
                    itemStyle={{ color: "#374151" }}
                    labelStyle={{ color: "#111827" }}
                    formatter={(value, name, props) => {
                      const originalValue =
                        props.payload?.originalValue || value;
                      return [`${originalValue} contacts`, name];
                    }}
                    labelFormatter={(label) => `Status: ${label}`}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend for all statuses including zero values */}
              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "16px",
                  justifyContent: "center",
                }}
              >
                {[
                  {
                    name: "Not Called",
                    value: callStats.notCalled,
                    color: "#f59e0b",
                    gradient:
                      "linear-gradient(to bottom, #fbbf24 0%, #f59e0b 100%)",
                    bgGradient: "#fef3c7",
                  },
                  {
                    name: "In Progress",
                    value: callStats.inProgress,
                    color: "#3b82f6",
                    gradient:
                      "linear-gradient(to bottom, #60a5fa 0%, #3b82f6 100%)",
                    bgGradient: "#dbeafe",
                  },
                  {
                    name: "Completed",
                    value: callStats.completed,
                    color: "#3b82f6",
                    gradient:
                      "linear-gradient(to bottom, #3b82f6 0%, #2563eb 100%)",
                    bgGradient: "#dbeafe",
                  },
                  {
                    name: "Failed",
                    value: callStats.failed,
                    color: "#dc2626",
                    gradient:
                      "linear-gradient(to bottom, #ef4444 0%, #dc2626 100%)",
                    bgGradient: "#fee2e2",
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background:
                        item.value > 0
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(255, 255, 255, 0.02)",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border:
                        item.value > 0
                          ? "1px solid rgba(255, 255, 255, 0.1)"
                          : "1px solid rgba(255, 255, 255, 0.05)",
                      boxShadow:
                        item.value > 0
                          ? "0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3)"
                          : "0 2px 4px rgba(0, 0, 0, 0.2)",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (item.value > 0) {
                        e.currentTarget.style.transform = "translateY(-3px)";
                        e.currentTarget.style.boxShadow =
                          "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (item.value > 0) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow =
                          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
                      }
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        background: item.value > 0 ? item.gradient : "#e5e7eb",
                        borderRadius: "8px",
                        boxShadow:
                          item.value > 0
                            ? "0 4px 12px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3)"
                            : "none",
                        filter: item.value > 0 ? "url(#glow)" : "none",
                        transition: "all 0.3s ease",
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: "700",
                          color: item.value === 0 ? "#9ca3af" : item.color,
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: item.value === 0 ? "#d1d5db" : "#6b7280",
                          fontWeight: "600",
                        }}
                      >
                        {item.value > 0 ? `${item.value} contacts` : "No data"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  {
                    name: "Not Called",
                    value:
                      dashboardSummary.contacts.byStatus.find(
                        (s) => s.status === "Not Called"
                      )?.count || 0,
                    color: "#f59e0b",
                  },
                  {
                    name: "In Progress",
                    value:
                      dashboardSummary.contacts.byStatus.find(
                        (s) => s.status === "In Progress"
                      )?.count || 0,
                    color: "#10b981",
                  },
                  {
                    name: "Completed",
                    value:
                      dashboardSummary.contacts.byStatus.find(
                        (s) => s.status === "Completed"
                      )?.count || 0,
                    color: "#8b5cf6",
                  },
                  {
                    name: "Failed",
                    value:
                      dashboardSummary.contacts.byStatus.find(
                        (s) => s.status === "Failed"
                      )?.count || 0,
                    color: "#ef4444",
                  },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [`${value} contacts`, name]}
                />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Analytics & Insights Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "24px",
          marginBottom: "24px",
        }}
      ></div>

      {/* Call Trends & Performance Insights */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "24px",
          marginBottom: "24px",
        }}
      >
        {/* Call Trends */}
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
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <TrendingUp
              style={{ width: "20px", height: "20px", color: "#8b5cf6" }}
            />
            Call Trends
          </h3>

          {/* Mini Line Chart */}
          <div style={{ height: "120px", marginBottom: "16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={
                  dailyTrends.length > 0
                    ? dailyTrends.map((trend) => ({
                        name: trend.dayName,
                        calls: trend.calls,
                        completed: trend.completed,
                        failed: trend.failed,
                      }))
                    : [
                        { name: "Mon", calls: 0 },
                        { name: "Tue", calls: 0 },
                        { name: "Wed", calls: 0 },
                        { name: "Thu", calls: 0 },
                        { name: "Fri", calls: 0 },
                        { name: "Sat", calls: 0 },
                        { name: "Sun", calls: 0 },
                      ]
                }
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Bar dataKey="calls" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#6b7280",
            }}
          >
            <span>Weekly Activity</span>
            <span>
              Peak:{" "}
              {dailyTrends.length > 0
                ? dailyTrends.reduce(
                    (max, day) => (day.calls > max.calls ? day : max),
                    dailyTrends[0]
                  )?.dayName +
                  ` (${
                    dailyTrends.reduce(
                      (max, day) => (day.calls > max.calls ? day : max),
                      dailyTrends[0]
                    )?.calls
                  } calls)`
                : "No data"}
            </span>
          </div>
        </div>

        {/* Performance Insights */}
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
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <BarChart3
              style={{ width: "20px", height: "20px", color: "#f59e0b" }}
            />
            Performance Insights
          </h3>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div
              style={{
                padding: "12px",
                backgroundColor:
                  dashboardSummary.calls.successRate < 50
                    ? "#fef3c7"
                    : "#f0fdf4",
                borderRadius: "8px",
                borderLeft: `4px solid ${
                  dashboardSummary.calls.successRate < 50
                    ? "#f59e0b"
                    : "#10b981"
                }`,
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color:
                    dashboardSummary.calls.successRate < 50
                      ? "#92400e"
                      : "#166534",
                  marginBottom: "4px",
                }}
              >
                {dashboardSummary.calls.successRate < 50
                  ? "⚠️ Low Success Rate"
                  : "✅ Good Success Rate"}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color:
                    dashboardSummary.calls.successRate < 50
                      ? "#a16207"
                      : "#16a34a",
                }}
              >
                {dashboardSummary.calls.successRate < 50
                  ? "Consider reviewing call scripts and training"
                  : `${dashboardSummary.calls.successRate}% success rate`}
              </div>
            </div>

            <div
              style={{
                padding: "12px",
                backgroundColor: "#f0f9ff",
                borderRadius: "8px",
                borderLeft: "4px solid #3b82f6",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#1e40af",
                  marginBottom: "4px",
                }}
              >
                💡 Pending Volume
              </div>
              <div style={{ fontSize: "12px", color: "#1d4ed8" }}>
                {dashboardSummary.contacts.byStatus.find(
                  (s) => s.status === "Not Called"
                )?.count || 0}{" "}
                contacts waiting for calls
              </div>
            </div>

            <div
              style={{
                padding: "12px",
                backgroundColor: "#f0fdf4",
                borderRadius: "8px",
                borderLeft: "4px solid #10b981",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#166534",
                  marginBottom: "4px",
                }}
              >
                📊 Today's Activity
              </div>
              <div style={{ fontSize: "12px", color: "#16a34a" }}>
                {dashboardSummary.calls.today} calls made today
              </div>
            </div>
          </div>
        </div>

        {/* Call Quality Metrics */}
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
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle
              style={{ width: "20px", height: "20px", color: "#10b981" }}
            />
            Call Quality
          </h3>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "14px", color: "#6b7280" }}>
                  Success Rate
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#111827",
                  }}
                >
                  {dashboardSummary.calls.successRate}%
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "6px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      dashboardSummary.calls.successRate,
                      100
                    )}%`,
                    height: "100%",
                    backgroundColor:
                      dashboardSummary.calls.successRate >= 70
                        ? "#10b981"
                        : dashboardSummary.calls.successRate >= 40
                        ? "#f59e0b"
                        : "#ef4444",
                    borderRadius: "3px",
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "14px", color: "#6b7280" }}>
                  Avg Duration
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#111827",
                  }}
                >
                  {Math.round(dashboardSummary.calls.avgDuration)}s
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "6px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      (dashboardSummary.calls.avgDuration / 300) * 100,
                      100
                    )}%`,
                    height: "100%",
                    backgroundColor:
                      dashboardSummary.calls.avgDuration >= 180
                        ? "#10b981"
                        : dashboardSummary.calls.avgDuration >= 60
                        ? "#f59e0b"
                        : "#ef4444",
                    borderRadius: "3px",
                  }}
                ></div>
              </div>
            </div>

            {dashboardSummary.calls.total > 0 ? (
              <>
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontSize: "14px", color: "#6b7280" }}>
                      Call Quality
                    </span>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color:
                          dashboardSummary.calls.successRate >= 70
                            ? "#10b981"
                            : dashboardSummary.calls.successRate >= 40
                            ? "#f59e0b"
                            : "#ef4444",
                      }}
                    >
                      {dashboardSummary.calls.successRate >= 70
                        ? "Good"
                        : dashboardSummary.calls.successRate >= 40
                        ? "Fair"
                        : "Poor"}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      backgroundColor: "#e5e7eb",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(
                          dashboardSummary.calls.successRate,
                          100
                        )}%`,
                        height: "100%",
                        backgroundColor:
                          dashboardSummary.calls.successRate >= 70
                            ? "#10b981"
                            : dashboardSummary.calls.successRate >= 40
                            ? "#f59e0b"
                            : "#ef4444",
                        borderRadius: "3px",
                      }}
                    ></div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    padding: "12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                      textAlign: "center",
                    }}
                  >
                    Avg Response Time:{" "}
                    <strong>
                      {Math.round(dashboardSummary.calls.avgDuration)}s
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#6b7280",
                  fontSize: "14px",
                }}
              >
                No call data available yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Analytics Card */}
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
        <h3
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#111827",
            margin: "0 0 20px 0",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <BarChart3
            style={{ width: "20px", height: "20px", color: "#3b82f6" }}
          />
          Advanced Analytics
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "20px",
          }}
        >
          {/* Call Success Rate */}
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              backgroundColor: "#f0f9ff",
              borderRadius: "8px",
              border: "1px solid #e0f2fe",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#0ea5e9",
                marginBottom: "8px",
              }}
            >
              {callStats.totalContacts > 0
                ? (
                    (callStats.completed / callStats.totalContacts) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </div>
            <div
              style={{ fontSize: "14px", color: "#0369a1", fontWeight: "600" }}
            >
              Call Success Rate
            </div>
            <div
              style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}
            >
              {callStats.completed} of {callStats.totalContacts} calls
            </div>
          </div>

          {/* Response Rate */}
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              backgroundColor: "#f0fdf4",
              borderRadius: "8px",
              border: "1px solid #dcfce7",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#22c55e",
                marginBottom: "8px",
              }}
            >
              {callStats.totalContacts > 0
                ? (
                    ((callStats.completed + callStats.failed) /
                      callStats.totalContacts) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </div>
            <div
              style={{ fontSize: "14px", color: "#16a34a", fontWeight: "600" }}
            >
              Response Rate
            </div>
            <div
              style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}
            >
              {callStats.completed + callStats.failed} responded
            </div>
          </div>

          {/* Call Efficiency */}
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              backgroundColor: "#fef3c7",
              borderRadius: "8px",
              border: "1px solid #fde68a",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#f59e0b",
                marginBottom: "8px",
              }}
            >
              {callStats.totalContacts > 0
                ? Math.min(
                    ((callStats.completed +
                      callStats.failed +
                      callStats.inProgress) /
                      callStats.totalContacts) *
                      100,
                    100
                  ).toFixed(1)
                : 0}
              %
            </div>
            <div
              style={{ fontSize: "14px", color: "#d97706", fontWeight: "600" }}
            >
              Call Efficiency
            </div>
            <div
              style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}
            >
              {callStats.completed + callStats.failed + callStats.inProgress}{" "}
              attempted
            </div>
          </div>

          {/* Average Duration */}
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              backgroundColor: "#f3e8ff",
              borderRadius: "8px",
              border: "1px solid #e9d5ff",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#8b5cf6",
                marginBottom: "8px",
              }}
            >
              {dashboardSummary.calls.avgDuration || 0}s
            </div>
            <div
              style={{ fontSize: "14px", color: "#7c3aed", fontWeight: "600" }}
            >
              Avg Duration
            </div>
            <div
              style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}
            >
              Per successful call
            </div>
          </div>
        </div>

        {/* Performance Metrics Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {/* Peak Hours */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "8px",
              }}
            >
              Peak Calling Hours
            </div>
            {hourlyTrends.length > 0 ? (
              <>
                {(() => {
                  const peakHours = hourlyTrends
                    .filter((h) => h.calls > 0)
                    .sort((a, b) => b.calls - a.calls)
                    .slice(0, 2);
                  return peakHours.map((hour, index) => (
                    <div
                      key={index}
                      style={{
                        fontSize: "12px",
                        color: "#6b7280",
                        marginBottom: "4px",
                      }}
                    >
                      {hour.timeLabel} ({hour.calls} calls)
                    </div>
                  ));
                })()}
              </>
            ) : (
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  fontStyle: "italic",
                }}
              >
                No call data available
              </div>
            )}
          </div>

          {/* Best Day */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "8px",
              }}
            >
              Best Performing Day
            </div>
            {dailyTrends.length > 0 ? (
              (() => {
                const bestDay = dailyTrends.reduce(
                  (max, day) => (day.calls > max.calls ? day : max),
                  dailyTrends[0]
                );
                return (
                  <>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: "700",
                        color: "#10b981",
                        marginBottom: "4px",
                      }}
                    >
                      {bestDay.dayName}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                      {bestDay.calls} calls completed
                    </div>
                  </>
                );
              })()
            ) : (
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  fontStyle: "italic",
                }}
              >
                No call data available
              </div>
            )}
          </div>

          {/* Conversion Rate */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "8px",
              }}
            >
              Conversion Rate
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#3b82f6",
                marginBottom: "4px",
              }}
            >
              {dashboardSummary.calls.successRate}%
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              Successful vs Failed
            </div>
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Recent Contacts
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Call
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.slice(0, 5).map((contact, index) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-700">
                            {contact.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {contact.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{contact.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        contact.status === "Completed"
                          ? "bg-green-100 text-green-800"
                          : contact.status === "Failed"
                          ? "bg-red-100 text-red-800"
                          : contact.status === "In Progress"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {contact.last_attempt
                      ? new Date(contact.last_attempt).toLocaleDateString()
                      : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
