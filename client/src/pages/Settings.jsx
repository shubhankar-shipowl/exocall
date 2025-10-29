import React, { useState } from "react";
import {
  Save,
  Bell,
  User,
  Shield,
  Info,
  CheckCircle,
  AlertCircle,
  Lock,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const Settings = () => {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState({
    notifications: true,
    emailNotifications: true,
    soundNotifications: false,
    autoRefresh: true,
    refreshInterval: 30,
    language: "en",
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    console.log(`[Settings] ${name} changed to: ${newValue}`);
    setSettings((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const showNotification = (message, type = "info") => {
    if (
      settings.notifications &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("ExoCall Dashboard", {
        body: message,
        icon: "/favicon.ico",
        tag: "settings-notification",
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Save settings to localStorage for persistence
      localStorage.setItem(
        "exocall-user-preferences",
        JSON.stringify(settings)
      );
      console.log("Saving settings:", settings);

      // Simulate save delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Show notification if enabled
      if (settings.notifications && settings.soundNotifications) {
        showNotification("Settings saved successfully!", "success");
      } else {
        alert("Settings saved successfully!");
      }

      setLastSaved(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Error saving settings!");
    } finally {
      setIsSaving(false);
    }
  };

  const testNotification = () => {
    if (settings.notifications) {
      showNotification("This is a test notification!", "info");
    } else {
      alert("Please enable notifications first!");
    }
  };

  const resetToDefaults = () => {
    const defaultSettings = {
      notifications: true,
      emailNotifications: true,
      soundNotifications: false,
      autoRefresh: true,
      refreshInterval: 30,
      language: "en",
      timezone: "UTC",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
    };
    setSettings(defaultSettings);
    localStorage.setItem(
      "exocall-user-preferences",
      JSON.stringify(defaultSettings)
    );
    alert("Settings reset to defaults!");
  };

  // Load settings from localStorage on component mount
  React.useEffect(() => {
    console.log("Loading settings from localStorage...");
    const savedSettings = localStorage.getItem("exocall-user-preferences");
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        console.log("Loaded settings:", parsedSettings);
        setSettings((prev) => ({ ...prev, ...parsedSettings }));
      } catch (error) {
        console.error("Error loading saved settings:", error);
      }
    } else {
      console.log("No saved settings found, using defaults");
    }
  }, []);

  // Apply notification settings
  React.useEffect(() => {
    console.log(
      `Notification settings changed: enabled=${settings.notifications}, sound=${settings.soundNotifications}`
    );
    if (settings.notifications && "Notification" in window) {
      if (Notification.permission === "default") {
        console.log("Requesting notification permission...");
        Notification.requestPermission()
          .then((permission) => {
            console.log(`Notification permission: ${permission}`);
            if (permission === "granted") {
              // Only show notification if sound notifications are enabled
              if (settings.soundNotifications) {
                showNotification(
                  "Notifications enabled successfully!",
                  "success"
                );
              }
            }
          })
          .catch((error) => {
            console.error("Error requesting notification permission:", error);
          });
      } else if (Notification.permission === "granted") {
        console.log("Notifications already enabled");
      }
    } else if (!settings.notifications) {
      console.log("Notifications disabled");
    }
  }, [settings.notifications, settings.soundNotifications]);

  // Apply language settings
  React.useEffect(() => {
    // Set document language
    document.documentElement.lang = settings.language;

    // Update page title based on language
    const titles = {
      en: "ExoCall Dashboard - Settings",
      es: "ExoCall Dashboard - Configuración",
      fr: "ExoCall Dashboard - Paramètres",
    };
    document.title = titles[settings.language] || titles.en;

    console.log("Language changed to:", settings.language);
  }, [settings.language]);

  // Apply timezone settings
  React.useEffect(() => {
    // Set timezone in localStorage for other components to use
    localStorage.setItem("exocall-timezone", settings.timezone);
    console.log("Timezone changed to:", settings.timezone);
  }, [settings.timezone]);

  // Apply auto refresh functionality
  React.useEffect(() => {
    let intervalId;
    if (settings.autoRefresh && settings.refreshInterval > 0) {
      console.log(`Auto refresh enabled: ${settings.refreshInterval} seconds`);
      intervalId = setInterval(() => {
        console.log("Auto refreshing page...");
        // Refresh the page or specific data
        window.location.reload();
      }, settings.refreshInterval * 1000);
    } else {
      console.log("Auto refresh disabled");
    }
    return () => {
      if (intervalId) {
        console.log("Clearing auto refresh interval");
        clearInterval(intervalId);
      }
    };
  }, [settings.autoRefresh, settings.refreshInterval]);

  const configurationInfo = [
    {
      title: "Database Configuration",
      description:
        "Database settings are managed through environment variables in the .env file",
      icon: (
        <Shield style={{ width: "20px", height: "20px", color: "#10b981" }} />
      ),
      status: "Configured via .env",
    },
    {
      title: "Exotel API Configuration",
      description:
        "API credentials are managed through environment variables in the .env file",
      icon: (
        <Shield style={{ width: "20px", height: "20px", color: "#3b82f6" }} />
      ),
      status: "Configured via .env",
    },
  ];

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "30px",
            fontWeight: "bold",
            color: "#111827",
            margin: 0,
          }}
        >
          Settings
        </h1>
        <p
          style={{
            color: "#6b7280",
            margin: "8px 0 0 0",
            fontSize: "16px",
          }}
        >
          Manage your dashboard preferences and application settings
        </p>
        {!isAdmin && (
          <div
            style={{
              backgroundColor: "#fef3c7",
              border: "1px solid #f59e0b",
              borderRadius: "8px",
              padding: "12px",
              marginTop: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Lock style={{ width: "16px", height: "16px", color: "#92400e" }} />
            <span style={{ color: "#92400e", fontSize: "14px" }}>
              Some settings can only be modified by administrators
            </span>
          </div>
        )}
      </div>

      {/* Configuration Status */}
      <div style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#111827",
            margin: "0 0 16px 0",
          }}
        >
          Configuration Status
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          {configurationInfo.map((config, index) => (
            <div
              key={index}
              style={{
                backgroundColor: "white",
                borderRadius: "8px",
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                padding: "20px",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              {config.icon}
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#111827",
                    margin: "0 0 4px 0",
                  }}
                >
                  {config.title}
                </h3>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    margin: "0 0 8px 0",
                  }}
                >
                  {config.description}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    color: "#059669",
                  }}
                >
                  <CheckCircle style={{ width: "16px", height: "16px" }} />
                  {config.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Preferences */}
      <div style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#111827",
            margin: "0 0 16px 0",
          }}
        >
          User Preferences
        </h2>
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "24px",
            }}
          >
            {/* Notifications */}
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: "0 0 16px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Bell style={{ width: "18px", height: "18px" }} />
                Notifications
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="notifications"
                    checked={settings.notifications}
                    onChange={handleInputChange}
                  />
                  Enable notifications
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="emailNotifications"
                    checked={settings.emailNotifications}
                    onChange={handleInputChange}
                  />
                  Email notifications
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="soundNotifications"
                    checked={settings.soundNotifications}
                    onChange={handleInputChange}
                  />
                  Sound notifications
                </label>
                <button
                  onClick={testNotification}
                  style={{
                    backgroundColor: "#3b82f6",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "500",
                    marginTop: "8px",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "#2563eb";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "#3b82f6";
                  }}
                >
                  Test Notification
                </button>
              </div>
            </div>

            {/* Auto Refresh */}
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: "0 0 16px 0",
                }}
              >
                Auto Refresh
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="autoRefresh"
                    checked={settings.autoRefresh}
                    onChange={handleInputChange}
                  />
                  Enable auto refresh
                </label>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      color: "#374151",
                      marginBottom: "4px",
                    }}
                  >
                    Refresh interval (seconds)
                  </label>
                  <input
                    type="number"
                    name="refreshInterval"
                    value={settings.refreshInterval}
                    onChange={handleInputChange}
                    min="5"
                    max="300"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  />
                  {settings.autoRefresh && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#059669",
                        marginTop: "4px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          backgroundColor: "#059669",
                          borderRadius: "50%",
                          animation: "pulse 2s infinite",
                        }}
                      ></div>
                      Auto refresh active ({settings.refreshInterval}s)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Language & Format */}
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: "0 0 16px 0",
                }}
              >
                Language & Format
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      color: "#374151",
                      marginBottom: "4px",
                    }}
                  >
                    Language
                  </label>
                  <select
                    name="language"
                    value={settings.language}
                    onChange={handleInputChange}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      color: "#374151",
                      marginBottom: "4px",
                    }}
                  >
                    Timezone
                  </label>
                  <select
                    name="timezone"
                    value={settings.timezone}
                    onChange={handleInputChange}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Information Section */}
      <div
        style={{
          backgroundColor: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <Info
            style={{
              width: "20px",
              height: "20px",
              color: "#3b82f6",
              marginTop: "2px",
            }}
          />
          <div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "#1e40af",
                margin: "0 0 8px 0",
              }}
            >
              Configuration Management
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "#1e40af",
                margin: 0,
                lineHeight: "1.5",
              }}
            >
              Database and API configurations are managed through environment
              variables in the server's .env file. This ensures security and
              prevents sensitive information from being exposed in the UI. To
              modify these settings, update the .env file in the server
              directory and restart the application.
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          onClick={resetToDefaults}
          style={{
            backgroundColor: "#6b7280",
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#4b5563";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "#6b7280";
          }}
        >
          Reset to Defaults
        </button>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "8px",
          }}
        >
          {lastSaved && (
            <div style={{ fontSize: "12px", color: "#059669" }}>
              Last saved: {lastSaved}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              backgroundColor: isSaving ? "#9ca3af" : "#3b82f6",
              color: "white",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: isSaving ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.target.style.backgroundColor = "#2563eb";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving) {
                e.target.style.backgroundColor = "#3b82f6";
              }
            }}
          >
            <Save style={{ width: "16px", height: "16px" }} />
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
