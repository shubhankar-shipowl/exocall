import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Upload,
  Phone,
  PhoneCall,
  Settings,
  FileText,
  LogOut,
  User,
  Users,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const Sidebar = () => {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();

  const menuItems = [
    { path: "/", icon: BarChart3, label: "Dashboard" },
    { path: "/call-table", icon: PhoneCall, label: "Call Table" },
    { path: "/calls", icon: Phone, label: "Call Logs" },
    { path: "/settings", icon: Settings, label: "Settings" },
    ...(isAdmin
      ? [
          { path: "/upload", icon: Upload, label: "Upload Contacts" },
          { path: "/users", icon: Users, label: "User Management" },
          { path: "/reports", icon: FileText, label: "Reports" },
        ]
      : []),
  ];

  return (
    <div
      style={{
        backgroundColor: "white",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        width: "256px",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "24px" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: "#1f2937",
            margin: 0,
          }}
        >
          ExoCall
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: "4px 0 0 0",
          }}
        >
          Support Dashboard
        </p>
      </div>

      <nav style={{ marginTop: "32px" }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 24px",
                color: isActive ? "#1d4ed8" : "#374151",
                backgroundColor: isActive ? "#eff6ff" : "transparent",
                borderRight: isActive
                  ? "2px solid #1d4ed8"
                  : "2px solid transparent",
                textDecoration: "none",
                transition: "all 0.2s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = "#f3f4f6";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = "transparent";
                }
              }}
            >
              <Icon
                style={{ width: "20px", height: "20px", marginRight: "12px" }}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Info and Logout */}
      <div
        style={{
          marginTop: "auto",
          padding: "24px",
          borderTop: "1px solid #e5e7eb",
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
          <div
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "#3b82f6",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <User style={{ width: "20px", height: "20px", color: "white" }} />
          </div>
          <div>
            <p
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#111827",
                margin: "0 0 2px 0",
              }}
            >
              {user?.firstName} {user?.lastName}
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: 0,
                textTransform: "capitalize",
              }}
            >
              {user?.role}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            backgroundColor: "#f3f4f6",
            color: "#374151",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#e5e7eb";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "#f3f4f6";
          }}
        >
          <LogOut style={{ width: "16px", height: "16px" }} />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
