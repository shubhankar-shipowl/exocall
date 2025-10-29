import React from "react";

// Skeleton for table rows
export const TableRowSkeleton = ({ columns = 5 }) => (
  <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
    {Array.from({ length: columns }).map((_, index) => (
      <td key={index} style={{ padding: "16px" }}>
        <div
          style={{
            height: "16px",
            backgroundColor: "#f3f4f6",
            borderRadius: "4px",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
      </td>
    ))}
  </tr>
);

// Skeleton for cards
export const CardSkeleton = ({ height = "200px" }) => (
  <div
    style={{
      backgroundColor: "white",
      borderRadius: "12px",
      boxShadow:
        "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      padding: "24px",
      height,
    }}
  >
    <div
      style={{
        height: "20px",
        backgroundColor: "#f3f4f6",
        borderRadius: "4px",
        marginBottom: "16px",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    />
    <div
      style={{
        height: "16px",
        backgroundColor: "#f3f4f6",
        borderRadius: "4px",
        marginBottom: "12px",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    />
    <div
      style={{
        height: "16px",
        backgroundColor: "#f3f4f6",
        borderRadius: "4px",
        width: "60%",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    />
  </div>
);

// Skeleton for stats cards
export const StatsCardSkeleton = () => (
  <div
    style={{
      backgroundColor: "white",
      borderRadius: "12px",
      boxShadow:
        "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      padding: "20px",
      display: "flex",
      alignItems: "center",
    }}
  >
    <div
      style={{
        width: "48px",
        height: "48px",
        backgroundColor: "#f3f4f6",
        borderRadius: "10px",
        marginRight: "16px",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    />
    <div style={{ flex: 1 }}>
      <div
        style={{
          height: "14px",
          backgroundColor: "#f3f4f6",
          borderRadius: "4px",
          marginBottom: "8px",
          width: "80%",
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      />
      <div
        style={{
          height: "24px",
          backgroundColor: "#f3f4f6",
          borderRadius: "4px",
          width: "40%",
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      />
    </div>
  </div>
);

// Skeleton for table
export const TableSkeleton = ({ rows = 5, columns = 5 }) => (
  <div
    style={{
      backgroundColor: "white",
      borderRadius: "8px",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      overflow: "hidden",
    }}
  >
    {/* Header skeleton */}
    <div
      style={{
        padding: "20px 24px",
        borderBottom: "1px solid #e5e7eb",
        backgroundColor: "#f9fafb",
      }}
    >
      <div
        style={{
          height: "18px",
          backgroundColor: "#f3f4f6",
          borderRadius: "4px",
          width: "200px",
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      />
    </div>

    {/* Table skeleton */}
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ backgroundColor: "#f9fafb" }}>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th
                key={index}
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    height: "12px",
                    backgroundColor: "#f3f4f6",
                    borderRadius: "4px",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRowSkeleton key={rowIndex} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Skeleton for chart
export const ChartSkeleton = ({ height = "300px" }) => (
  <div
    style={{
      backgroundColor: "white",
      borderRadius: "12px",
      boxShadow:
        "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      padding: "24px",
      height,
    }}
  >
    <div
      style={{
        height: "20px",
        backgroundColor: "#f3f4f6",
        borderRadius: "4px",
        marginBottom: "20px",
        width: "200px",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    />
    <div
      style={{
        height: "200px",
        backgroundColor: "#f3f4f6",
        borderRadius: "8px",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    />
  </div>
);

// Skeleton for modal
export const ModalSkeleton = () => (
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
  >
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        boxShadow:
          "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        width: "100%",
        maxWidth: "800px",
        maxHeight: "90vh",
        overflow: "hidden",
      }}
    >
      {/* Header skeleton */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            height: "20px",
            backgroundColor: "#f3f4f6",
            borderRadius: "4px",
            width: "150px",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <div
          style={{
            width: "20px",
            height: "20px",
            backgroundColor: "#f3f4f6",
            borderRadius: "4px",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
      </div>

      {/* Content skeleton */}
      <div style={{ padding: "24px" }}>
        <div
          style={{
            height: "16px",
            backgroundColor: "#f3f4f6",
            borderRadius: "4px",
            marginBottom: "16px",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <div
          style={{
            height: "16px",
            backgroundColor: "#f3f4f6",
            borderRadius: "4px",
            marginBottom: "16px",
            width: "80%",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <div
          style={{
            height: "100px",
            backgroundColor: "#f3f4f6",
            borderRadius: "8px",
            marginBottom: "24px",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              height: "36px",
              width: "80px",
              backgroundColor: "#f3f4f6",
              borderRadius: "8px",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          <div
            style={{
              height: "36px",
              width: "100px",
              backgroundColor: "#f3f4f6",
              borderRadius: "8px",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        </div>
      </div>
    </div>
  </div>
);

// Add CSS animation for pulse effect
const style = document.createElement("style");
style.textContent = `
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;
document.head.appendChild(style);

export default {
  TableRowSkeleton,
  CardSkeleton,
  StatsCardSkeleton,
  TableSkeleton,
  ChartSkeleton,
  ModalSkeleton,
};
