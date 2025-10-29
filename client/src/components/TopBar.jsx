import { Bell, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const TopBar = () => {
  const { user } = useAuth();

  return (
    <header
      style={{
        backgroundColor: "white",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        borderBottom: "1px solid #e5e7eb",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#1f2937",
            margin: 0,
          }}
        >
          Welcome back, {user?.firstName || user?.username}
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: "4px 0 0 0",
          }}
        >
          Here's what's happening with your calls today.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          style={{
            padding: "8px",
            color: "#6b7280",
            backgroundColor: "transparent",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.color = "#374151";
            e.target.style.backgroundColor = "#f3f4f6";
          }}
          onMouseLeave={(e) => {
            e.target.style.color = "#6b7280";
            e.target.style.backgroundColor = "transparent";
          }}
        >
          <Bell style={{ width: "20px", height: "20px" }} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              backgroundColor: "#3b82f6",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <User style={{ width: "20px", height: "20px", color: "white" }} />
          </div>
          <span
            style={{
              fontSize: "14px",
              fontWeight: "500",
              color: "#374151",
              textTransform: "capitalize",
            }}
          >
            {user?.role}
          </span>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
