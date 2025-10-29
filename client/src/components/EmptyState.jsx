import React from "react";
import {
  Phone,
  Users,
  FileText,
  BarChart3,
  Upload,
  RefreshCw,
  Plus,
  Search,
  Filter,
} from "lucide-react";

const EmptyState = ({
  icon: Icon = Phone,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  type = "default", // default, search, upload, error, success
  size = "medium", // small, medium, large
}) => {
  const getIconColor = () => {
    switch (type) {
      case "error":
        return "#ef4444";
      case "success":
        return "#10b981";
      case "warning":
        return "#f59e0b";
      case "info":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  const getIconBgColor = () => {
    switch (type) {
      case "error":
        return "#fee2e2";
      case "success":
        return "#d1fae5";
      case "warning":
        return "#fef3c7";
      case "info":
        return "#eff6ff";
      default:
        return "#f3f4f6";
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return {
          padding: "24px",
          iconSize: "32px",
          iconPadding: "8px",
          titleSize: "16px",
          descriptionSize: "14px",
        };
      case "large":
        return {
          padding: "48px 24px",
          iconSize: "64px",
          iconPadding: "16px",
          titleSize: "24px",
          descriptionSize: "16px",
        };
      default: // medium
        return {
          padding: "40px 24px",
          iconSize: "48px",
          iconPadding: "12px",
          titleSize: "18px",
          descriptionSize: "14px",
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <div
      style={{
        padding: sizeStyles.padding,
        textAlign: "center",
        color: "#6b7280",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: size === "large" ? "300px" : "200px",
      }}
    >
      {/* Icon */}
      <div
        style={{
          padding: sizeStyles.iconPadding,
          backgroundColor: getIconBgColor(),
          borderRadius: "12px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          style={{
            width: sizeStyles.iconSize,
            height: sizeStyles.iconSize,
            color: getIconColor(),
          }}
        />
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: sizeStyles.titleSize,
          fontWeight: "500",
          margin: "0 0 8px 0",
          color: "#111827",
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: sizeStyles.descriptionSize,
          margin: "0 0 24px 0",
          maxWidth: "400px",
          lineHeight: "1.5",
        }}
      >
        {description}
      </p>

      {/* Actions */}
      {(actionText || secondaryActionText) && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {actionText && onAction && (
            <button
              onClick={onAction}
              style={{
                backgroundColor: "#3b82f6",
                color: "white",
                padding: "8px 16px",
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
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#2563eb";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#3b82f6";
              }}
            >
              {actionText}
            </button>
          )}

          {secondaryActionText && onSecondaryAction && (
            <button
              onClick={onSecondaryAction}
              style={{
                backgroundColor: "#f3f4f6",
                color: "#374151",
                padding: "8px 16px",
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
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#e5e7eb";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#f3f4f6";
              }}
            >
              {secondaryActionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Predefined empty states for common scenarios
export const EmptyStates = {
  NoCalls: (props) => (
    <EmptyState
      icon={Phone}
      title="No calls found"
      description="Try adjusting your filters or select a different date range to view call history."
      {...props}
    />
  ),

  NoContacts: (props) => (
    <EmptyState
      icon={Users}
      title="No contacts available"
      description="Upload a contact list to start making calls and track your progress."
      {...props}
    />
  ),

  NoReports: (props) => (
    <EmptyState
      icon={BarChart3}
      title="No reports available"
      description="Generate reports to view analytics and insights about your calling campaigns."
      actionText="Generate Report"
      {...props}
    />
  ),

  NoData: (props) => (
    <EmptyState
      icon={FileText}
      title="No data available"
      description="There's no data to display at the moment. Check back later or try refreshing."
      actionText="Refresh"
      {...props}
    />
  ),

  SearchEmpty: (props) => (
    <EmptyState
      icon={Search}
      title="No results found"
      description="Try adjusting your search criteria or filters to find what you're looking for."
      actionText="Clear Search"
      secondaryActionText="Reset Filters"
      type="info"
      {...props}
    />
  ),

  UploadPrompt: (props) => (
    <EmptyState
      icon={Upload}
      title="Upload your contacts"
      description="Get started by uploading a CSV file with your contact information."
      actionText="Upload File"
      type="info"
      {...props}
    />
  ),

  Error: (props) => (
    <EmptyState
      icon={RefreshCw}
      title="Something went wrong"
      description="We encountered an error while loading your data. Please try again."
      actionText="Try Again"
      type="error"
      {...props}
    />
  ),

  Success: (props) => (
    <EmptyState
      icon={CheckCircle}
      title="All done!"
      description="Your action has been completed successfully."
      type="success"
      {...props}
    />
  ),
};

export default EmptyState;
