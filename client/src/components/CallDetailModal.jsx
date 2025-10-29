import { useState, useEffect } from "react";
import {
  X,
  Phone,
  Clock,
  CheckCircle,
  RotateCcw,
  Save,
  Volume2,
  VolumeX,
  User,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { toast } from "react-toastify";
import ConfirmationModal from "./ConfirmationModal";
import { ModalSkeleton } from "./LoadingSkeleton";

const CallDetailModal = ({ isOpen, onClose, contactId }) => {
  const [contact, setContact] = useState(null);
  const [callLogs, setCallLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [notes, setNotes] = useState("");
  const [playingRecording, setPlayingRecording] = useState(null);

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

  // Fetch contact details when modal opens
  useEffect(() => {
    if (isOpen && contactId) {
      fetchContactDetails();
    }
  }, [isOpen, contactId]);

  // Set notes when contact data loads
  useEffect(() => {
    if (contact) {
      // Filter out the single Excel import header line if present,
      // but keep any agent-entered notes that follow it.
      const raw = contact.agent_notes || "";
      const filtered = raw
        .split(/\r?\n/)
        .filter(
          (line) =>
            !line.trim().toLowerCase().startsWith("imported from excel.")
        )
        .join("\n")
        .trim();
      setNotes(filtered);
    }
  }, [contact]);

  const fetchContactDetails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/contact-detail/${contactId}`);
      if (response.ok) {
        const data = await response.json();
        setContact(data.contact);
        setCallLogs(data.callLogs);
      } else {
        toast.error("Failed to fetch contact details");
      }
    } catch (error) {
      console.error("Error fetching contact details:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!notes.trim()) {
      toast.error("Please enter some notes");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/contact-detail/${contactId}/note`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: notes.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Notes saved successfully");
        setContact({ ...contact, agent_notes: notes.trim() });
      } else {
        toast.error(result.error || "Failed to save notes");
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetryCall = () => {
    setConfirmationModal({
      isOpen: true,
      type: "warning",
      title: "Retry Call",
      message: `Are you sure you want to retry the call for ${contact?.name}? This will reset the call status and attempt again.`,
      onConfirm: () => confirmRetryCall(),
      confirmText: "Retry",
      confirmButtonColor: "#f59e0b",
    });
  };

  const confirmRetryCall = async () => {
    setIsRetrying(true);
    try {
      const response = await fetch(`/api/contact-detail/${contactId}/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Call retry initiated successfully");
        // Refresh contact details
        await fetchContactDetails();
        onClose(); // Close modal after successful retry
      } else {
        toast.error(result.error || "Failed to retry call");
      }
    } catch (error) {
      console.error("Error retrying call:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsRetrying(false);
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleMarkResolved = () => {
    if (!notes.trim()) {
      toast.error("Please add notes before marking as resolved");
      return;
    }

    setConfirmationModal({
      isOpen: true,
      type: "info",
      title: "Mark as Resolved",
      message: `Are you sure you want to mark ${contact?.name} as resolved? This will update the contact status and save your notes.`,
      onConfirm: () => confirmMarkResolved(),
      confirmText: "Mark Resolved",
      confirmButtonColor: "#10b981",
    });
  };

  const confirmMarkResolved = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/contact-detail/${contactId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: notes.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Contact marked as resolved");
        // Refresh contact details
        await fetchContactDetails();
        onClose(); // Close modal after successful resolution
      } else {
        toast.error(result.error || "Failed to mark as resolved");
      }
    } catch (error) {
      console.error("Error marking as resolved:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsSaving(false);
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const playRecording = (recordingUrl) => {
    if (!recordingUrl) {
      toast.error("No recording available");
      return;
    }

    if (playingRecording === recordingUrl) {
      // Stop current recording
      setPlayingRecording(null);
      return;
    }

    const audio = new Audio(recordingUrl);
    audio
      .play()
      .then(() => {
        setPlayingRecording(recordingUrl);
      })
      .catch(() => {
        toast.error("Failed to play recording");
      });

    audio.onended = () => {
      setPlayingRecording(null);
    };
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "N/A";
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
      Busy: { bg: "#fed7aa", text: "#9a3412", border: "#ea580c" },
      "No Answer": { bg: "#fef3c7", text: "#92400e", border: "#f59e0b" },
      "Switched Off": { bg: "#f3f4f6", text: "#374151", border: "#6b7280" },
      Cancelled: { bg: "#fee2e2", text: "#991b1b", border: "#ef4444" },
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

  if (!isOpen) return null;

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
        if (e.target === e.currentTarget) onClose();
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
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#111827",
              margin: 0,
            }}
          >
            Call Details
          </h2>
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
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {isLoading ? (
            <ModalSkeleton />
          ) : contact ? (
            <div style={{ padding: "24px" }}>
              {/* Contact Information */}
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  padding: "20px",
                  marginBottom: "24px",
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
                      padding: "8px",
                      backgroundColor: "#3b82f6",
                      borderRadius: "8px",
                    }}
                  >
                    <User
                      style={{ width: "20px", height: "20px", color: "white" }}
                    />
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#111827",
                        margin: 0,
                      }}
                    >
                      {contact.name}
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#6b7280",
                        margin: "4px 0 0 0",
                      }}
                    >
                      {contact.phone}
                    </p>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    {getStatusBadge(contact.status)}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "500",
                        color: "#6b7280",
                        margin: "0 0 4px 0",
                      }}
                    >
                      ATTEMPTS
                    </p>
                    <p
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#111827",
                        margin: 0,
                      }}
                    >
                      {contact.attempts || 0}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "500",
                        color: "#6b7280",
                        margin: "0 0 4px 0",
                      }}
                    >
                      DURATION
                    </p>
                    <p
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#111827",
                        margin: 0,
                      }}
                    >
                      {formatDuration(contact.duration)}
                    </p>
                  </div>
                </div>

                {contact.message && (
                  <div style={{ marginTop: "16px" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "500",
                        color: "#6b7280",
                        margin: "0 0 4px 0",
                      }}
                    >
                      MESSAGE
                    </p>
                    <p
                      style={{ fontSize: "14px", color: "#111827", margin: 0 }}
                    >
                      {contact.message}
                    </p>
                  </div>
                )}
              </div>

              {/* Call Logs */}
              <div style={{ marginBottom: "24px" }}>
                <h4
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#111827",
                    margin: "0 0 16px 0",
                  }}
                >
                  Call History
                </h4>
                {callLogs.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {callLogs.map((log, index) => (
                      <div
                        key={log.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          padding: "16px",
                          backgroundColor: "white",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "8px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <Clock
                              style={{
                                width: "16px",
                                height: "16px",
                                color: "#6b7280",
                              }}
                            />
                            <span
                              style={{
                                fontSize: "14px",
                                fontWeight: "500",
                                color: "#111827",
                              }}
                            >
                              Attempt #{log.attempt_no}
                            </span>
                            {getStatusBadge(log.status)}
                          </div>
                          <span style={{ fontSize: "12px", color: "#6b7280" }}>
                            {formatDateTime(log.createdAt)}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "16px",
                            }}
                          >
                            <span
                              style={{ fontSize: "12px", color: "#6b7280" }}
                            >
                              Duration: {formatDuration(log.duration)}
                            </span>
                            {log.recording_url && (
                              <button
                                onClick={() => playRecording(log.recording_url)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  color:
                                    playingRecording === log.recording_url
                                      ? "#ef4444"
                                      : "#3b82f6",
                                  fontSize: "12px",
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = "#f3f4f6";
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor =
                                    "transparent";
                                }}
                              >
                                {playingRecording === log.recording_url ? (
                                  <VolumeX
                                    style={{ width: "14px", height: "14px" }}
                                  />
                                ) : (
                                  <Volume2
                                    style={{ width: "14px", height: "14px" }}
                                  />
                                )}
                                {playingRecording === log.recording_url
                                  ? "Stop"
                                  : "Play"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    style={{
                      color: "#6b7280",
                      fontSize: "14px",
                      textAlign: "center",
                      padding: "20px",
                    }}
                  >
                    No call attempts yet
                  </p>
                )}
              </div>

              {/* Notes Section */}
              <div style={{ marginBottom: "24px" }}>
                <h4
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#111827",
                    margin: "0 0 12px 0",
                  }}
                >
                  Agent Notes
                </h4>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your notes here..."
                  style={{
                    width: "100%",
                    minHeight: "100px",
                    padding: "12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={handleSaveNotes}
                  disabled={isSaving || !notes.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    backgroundColor:
                      isSaving || !notes.trim() ? "#9ca3af" : "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor:
                      isSaving || !notes.trim() ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  <Save style={{ width: "16px", height: "16px" }} />
                  {isSaving ? "Saving..." : "Save Notes"}
                </button>

                {contact.status === "Failed" && (
                  <button
                    onClick={handleRetryCall}
                    disabled={isRetrying}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 16px",
                      backgroundColor: isRetrying ? "#9ca3af" : "#f59e0b",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: isRetrying ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    <RotateCcw style={{ width: "16px", height: "16px" }} />
                    {isRetrying ? "Retrying..." : "Retry Call"}
                  </button>
                )}

                <button
                  onClick={handleMarkResolved}
                  disabled={isSaving || !notes.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    backgroundColor:
                      isSaving || !notes.trim() ? "#9ca3af" : "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor:
                      isSaving || !notes.trim() ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  <CheckCircle style={{ width: "16px", height: "16px" }} />
                  {isSaving ? "Saving..." : "Mark as Resolved"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ color: "#6b7280", margin: 0 }}>Contact not found</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={() =>
          setConfirmationModal((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={confirmationModal.onConfirm}
        title={confirmationModal.title}
        message={confirmationModal.message}
        confirmText={confirmationModal.confirmText}
        type={confirmationModal.type}
        confirmButtonColor={confirmationModal.confirmButtonColor}
        isLoading={isRetrying || isSaving}
      />
    </div>
  );
};

export default CallDetailModal;
