import React, { useState, useEffect, useCallback } from "react";
import {
  Phone,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Loader,
  Calendar,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  StickyNote,
  Save,
  Edit,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import ConfirmationModal from "./ConfirmationModal";
import CallModal from "./CallModal";
import { EmptyStates } from "./EmptyState";
import { TableSkeleton } from "./LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";

const CallTable = () => {
  const { isAdmin } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [callingContacts, setCallingContacts] = useState(new Set()); // Track which contacts are being called
  const [pollingInterval, setPollingInterval] = useState(null);
  const [noteModal, setNoteModal] = useState({
    isOpen: false,
    contactId: null,
    contactName: "",
    currentNotes: "",
    newNote: "",
  });
  const [editingNote, setEditingNote] = useState({
    index: null,
    value: "",
    originalValue: "",
    timestamp: "",
  });
  const [callModal, setCallModal] = useState({
    isOpen: false,
    contact: null,
    callStatus: "In Progress",
    callDuration: 0,
  });

  // Store polling interval ref to cleanup properly
  const pollingIntervalRef = React.useRef(null);
  const [dateFilter, setDateFilter] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [storeFilter, setStoreFilter] = useState("all");

  // Safe modal state setter
  const safeSetCallModal = (newState) => {
    try {
      if (typeof newState === "function") {
        setCallModal((prev) => {
          const result = newState(prev);
          // Validate the result
          if (result && typeof result === "object") {
            return {
              isOpen: Boolean(result.isOpen),
              contact: result.contact || null,
              callStatus: result.callStatus || "In Progress",
              callDuration: Number(result.callDuration) || 0,
            };
          }
          return prev;
        });
      } else if (typeof newState === "object") {
        setCallModal({
          isOpen: Boolean(newState.isOpen),
          contact: newState.contact || null,
          callStatus: newState.callStatus || "In Progress",
          callDuration: Number(newState.callDuration) || 0,
        });
      }
    } catch (error) {
      console.error("Error setting call modal state:", error);
    }
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Date filtering helper functions
  const formatDate = (dateInput) => {
    if (!dateInput) return "";

    let date;
    if (dateInput instanceof Date) {
      date = new Date(dateInput);
    } else {
      date = new Date(dateInput);
    }

    // Format as YYYY-MM-DD using local date (not UTC)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const isDateInRange = (contactDate, filterDate) => {
    if (!filterDate) return true;
    const contact = new Date(contactDate);
    const filter = new Date(filterDate);
    return contact.toDateString() === filter.toDateString();
  };

  const getDateRangeFilter = (range) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    switch (range) {
      case "today":
        return formatDate(today);
      case "yesterday":
        return formatDate(yesterday);
      default:
        return "";
    }
  };

  // Fetch contacts from API
  const fetchContacts = useCallback(async () => {
    try {
      // Add cache-busting parameter
      const timestamp = new Date().getTime();
      console.log(
        "🔄 [Frontend CallTable] - Fetching contacts from /api/contacts"
      );
      console.log(
        "[Frontend CallTable] Request URL:",
        `/api/contacts?t=${timestamp}`
      );

      const response = await fetch(`/api/contacts?t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      console.log("[Frontend CallTable] Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log(
          "✅ [Frontend CallTable] - Successfully received contacts:",
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

        // Update call modal if it's open
        if (callModal.isOpen && callModal.contact) {
          const updatedContact = data.find(
            (c) => c.id === callModal.contact.id
          );
          if (
            updatedContact &&
            updatedContact.status !== callModal.callStatus
          ) {
            safeSetCallModal((prev) => ({
              ...prev,
              callStatus: updatedContact.status,
              callDuration: updatedContact.duration || 0,
            }));
          }
        }
      } else {
        console.error("Failed to fetch contacts");
        toast.error("Failed to load contacts");
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Network error while loading contacts");
    } finally {
      setIsLoading(false);
    }
  }, [callModal.isOpen, callModal.contact?.id, callModal.callStatus]);

  // Start polling for live updates
  useEffect(() => {
    // Initial fetch
    fetchContacts();

    // Set up polling every 10 seconds
    const interval = setInterval(fetchContacts, 10000);
    setPollingInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchContacts]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDatePicker && !event.target.closest("[data-date-picker]")) {
        setShowDatePicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker]);

  // Filter contacts based on date (using createdAt - upload date)
  // Get unique stores from contacts
  const uniqueStores = [
    ...new Set(contacts.filter((c) => c.store).map((c) => c.store)),
  ].sort();

  const filteredContacts = contacts.filter((contact) => {
    // Date filter
    if (dateFilter) {
      const contactDate = contact.createdAt || contact.created_at;
      if (!isDateInRange(contactDate, dateFilter)) return false;
    }

    // Store filter
    if (storeFilter !== "all") {
      if (!contact.store || contact.store !== storeFilter) return false;
    }

    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, dateRange, storeFilter]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Check if contacts exist on a specific date
  const hasContactsOnDate = (date) => {
    if (!contacts || contacts.length === 0) return false;

    const dateString = formatDate(date);
    return contacts.some((contact) => {
      const contactDate = contact.createdAt || contact.created_at;
      if (!contactDate) return false;
      return formatDate(contactDate) === dateString;
    });
  };

  // Date picker handlers
  const handleDateRangeChange = (range) => {
    setDateRange(range);
    if (range === "all") {
      setDateFilter("");
    } else {
      const date = getDateRangeFilter(range);
      setDateFilter(date);
    }
    setShowDatePicker(false);
  };

  const handleCustomDateChange = (date) => {
    const formattedDate = formatDate(date);
    setDateFilter(formattedDate);
    setDateRange("custom");
    setShowDatePicker(false);
  };

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -startingDayOfWeek + i + 1);
      days.push({
        date: prevMonthDay,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasContacts: hasContactsOnDate(prevMonthDay),
      });
    }

    // Add days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected =
        dateFilter &&
        date.toDateString() === new Date(dateFilter).toDateString();

      days.push({
        date,
        isCurrentMonth: true,
        isToday,
        isSelected,
        hasContacts: hasContactsOnDate(date),
      });
    }

    // Add empty cells to complete the grid (6 rows x 7 days = 42 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonthDay = new Date(year, month + 1, i);
      days.push({
        date: nextMonthDay,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasContacts: hasContactsOnDate(nextMonthDay),
      });
    }

    return days;
  };

  const clearDateFilter = () => {
    setDateFilter("");
    setDateRange("all");
    setShowDatePicker(false);
    setStoreFilter("all");
  };

  // Handle call initiation
  const handleCall = async (contactId, contactName) => {
    try {
      console.log("handleCall called with:", { contactId, contactName });

      const contact = contacts.find((c) => c.id === contactId);
      if (!contact) {
        console.error("Contact not found for ID:", contactId);
        toast.error("Contact not found");
        return;
      }

      console.log("Opening call modal for contact:", contact);

      safeSetCallModal({
        isOpen: true,
        contact: contact,
        callStatus: "In Progress",
        callDuration: 0,
      });

      // Clear any existing polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Start the actual call and wait for it to complete
      await confirmCall(contactId, contactName);

      // Start polling for status updates every 5 seconds
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/contacts/${contactId}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });

          if (response.ok) {
            const contactData = await response.json();
            if (contactData && contactData.status) {
              // Update the contact in the list
              setContacts((prevContacts) =>
                prevContacts.map((contact) =>
                  contact.id === contactId
                    ? {
                        ...contact,
                        status: contactData.status,
                        attempts: contactData.attempts || contact.attempts,
                        duration: contactData.duration || contact.duration,
                      }
                    : contact
                )
              );

              // Update modal status
              safeSetCallModal((prev) => {
                if (prev.isOpen && prev.contact?.id === contactId) {
                  return {
                    ...prev,
                    callStatus: contactData.status,
                    callDuration: contactData.duration || 0,
                  };
                }
                return prev;
              });

              // If status is final (not "In Progress" or "Initiated"), stop polling
              const finalStatuses = [
                "Completed",
                "Failed",
                "Hangup",
                "Busy",
                "No Answer",
                "Switched Off",
                "Cancelled",
              ];
              if (
                contactData.status !== "In Progress" &&
                contactData.status !== "Initiated" &&
                contactData.status !== "Not Called" &&
                finalStatuses.includes(contactData.status)
              ) {
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
                console.log(`Call ended with status: ${contactData.status}`);

                // Update modal status to show final status
                safeSetCallModal((prev) => ({
                  ...prev,
                  callStatus: contactData.status,
                  callDuration: contactData.duration || 0,
                }));
              }
            }
          }
        } catch (error) {
          console.error("Error polling status:", error);
        }
      }, 5000); // Poll every 5 seconds

      // No auto-close timeout - modal stays open until user closes it or call ends
    } catch (error) {
      console.error("Error in handleCall:", error);
      toast.error("Failed to initiate call. Please try again.");
    }
  };

  const confirmCall = async (contactId, contactName) => {
    try {
      console.log("confirmCall called with:", { contactId, contactName });

      // Add contact to calling set and show immediate feedback
      setCallingContacts((prev) => new Set(prev).add(contactId));

      // Add small delay to ensure toast appears after modal is rendered
      await new Promise((resolve) => setTimeout(resolve, 100));
      toast.info(`Calling ${contactName}...`);

      const response = await fetch(`/api/contacts/${contactId}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      console.log("API response status:", response.status);

      let result;
      try {
        result = await response.json();
        console.log("API response data:", result);
        console.log("Response OK:", response.ok);
        console.log("Result success:", result.success);
        console.log("Result message:", result.message);
      } catch (parseError) {
        console.error("Error parsing JSON response:", parseError);
        throw new Error("Invalid response from server");
      }

      if (response.ok && result.success === true) {
        // Don't update contact status optimistically - let backend handle real status
        // Only update the modal to show "In Progress" status
        safeSetCallModal((prev) => ({
          ...prev,
          callStatus: "In Progress",
        }));

        toast.success(
          `Call initiated for ${contactName}! Please wait for the call to connect.`
        );
      } else if (response.ok && result.success === false) {
        // Handle explicit failure from backend
        const errorMessage = result.message || result.error || "Call failed!";
        toast.error(errorMessage);

        // Keep modal open but update status to show error
        safeSetCallModal((prev) => ({
          ...prev,
          callStatus: "Failed",
        }));
      } else {
        // Handle HTTP error responses or missing success field
        const errorMessage = result.message || result.error || "Call failed!";
        console.error("Unexpected response:", {
          response: response.ok,
          result,
        });
        toast.error(errorMessage);

        // Keep modal open but update status to show error
        safeSetCallModal((prev) => ({
          ...prev,
          callStatus: "Failed",
        }));
      }
    } catch (error) {
      console.error("Error initiating call:", error);
      toast.error("Network error. Please try again.");
      // Keep modal open but update status to show error
      safeSetCallModal((prev) => ({
        ...prev,
        callStatus: "Failed",
      }));
    } finally {
      // Remove contact from calling set
      setCallingContacts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    }
  };

  // Handle call status updates
  const updateCallStatus = (contactId, newStatus, duration = 0) => {
    setContacts((prevContacts) =>
      prevContacts.map((contact) =>
        contact.id === contactId
          ? {
              ...contact,
              status: newStatus,
              duration: duration,
            }
          : contact
      )
    );

    // Update modal if it's open for this contact
    if (callModal.isOpen && callModal.contact?.id === contactId) {
      safeSetCallModal((prev) => ({
        ...prev,
        callStatus: newStatus,
        callDuration: duration,
      }));
    }
  };

  // Handle call modal close
  const handleCallModalClose = () => {
    // Clear polling interval when modal is closed
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    safeSetCallModal({
      isOpen: false,
      contact: null,
      callStatus: "In Progress",
      callDuration: 0,
    });
  };

  // Format notes for better readability - only show agent notes, exclude import info
  const formatNotesForDisplay = (notes) => {
    if (!notes || !notes.trim()) return [];

    const lines = notes.split(/\r?\n/);
    const formatted = [];
    let hasNotes = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        return;
      }

      // Skip Excel import information completely
      if (trimmed.startsWith("Imported from Excel.")) {
        return; // Skip this line entirely
      }

      // Check if it's a timestamped note entry [timestamp] note
      if (/^\[\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
        if (!hasNotes) {
          formatted.push({ type: "header", content: "Agent Notes" });
          hasNotes = true;
        }

        const match = trimmed.match(/^\[([^\]]+)\]\s*(.+)$/);
        if (match && match[2]) {
          formatted.push({
            type: "note",
            originalIndex: index,
            timestamp: match[1].trim(),
            content: match[2].trim(),
            fullLine: trimmed,
          });
        } else {
          formatted.push({
            type: "note",
            originalIndex: index,
            timestamp: "",
            content: trimmed,
            fullLine: trimmed,
          });
        }
      }
      // Only include other text if it's not empty and not import-related
      else if (
        trimmed &&
        !trimmed.toLowerCase().includes("order:") &&
        !trimmed.toLowerCase().includes("product:")
      ) {
        if (!hasNotes) {
          formatted.push({ type: "header", content: "Agent Notes" });
          hasNotes = true;
        }
        formatted.push({
          type: "note",
          originalIndex: index,
          timestamp: "",
          content: trimmed,
          fullLine: trimmed,
        });
      }
    });

    return formatted;
  };

  // Extract agent notes as individual note objects (excluding import info)
  const extractAgentNotes = (notes) => {
    if (!notes || !notes.trim()) return [];

    const lines = notes.split(/\r?\n/).filter((line) => line.trim());
    const agentNotes = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Skip Excel import information completely
      if (trimmed.startsWith("Imported from Excel.")) {
        return;
      }

      // Skip import-related lines
      if (
        trimmed.toLowerCase().includes("order:") ||
        trimmed.toLowerCase().includes("product:")
      ) {
        return;
      }

      // Check if it's a timestamped note entry [timestamp] note
      if (/^\[\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
        const match = trimmed.match(/^\[([^\]]+)\]\s*(.+)$/);
        if (match && match[2]) {
          agentNotes.push({
            originalIndex: index,
            fullLine: trimmed,
            timestamp: match[1].trim(),
            content: match[2].trim(),
          });
        }
      }
      // Include other text notes
      else if (trimmed) {
        agentNotes.push({
          originalIndex: index,
          fullLine: trimmed,
          timestamp: "",
          content: trimmed,
        });
      }
    });

    return agentNotes;
  };

  // Delete a note
  const handleDeleteNote = async (originalIndex) => {
    if (!confirm("Are you sure you want to delete this note?")) {
      return;
    }

    try {
      const lines = noteModal.currentNotes.split(/\r?\n/);
      const updatedLines = lines.filter((_, idx) => idx !== originalIndex);
      const updatedNotes = updatedLines.join("\n").trim();

      const response = await fetch(
        `/api/contact-detail/${noteModal.contactId}/note`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ notes: updatedNotes }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNoteModal((prev) => ({
          ...prev,
          currentNotes: data.contact.agent_notes || "",
        }));
        toast.success("Note deleted successfully!");
        await fetchContacts();
      } else {
        toast.error("Failed to delete note");
      }
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note");
    }
  };

  // Start editing a note
  const handleStartEditNote = (originalIndex, timestamp, content) => {
    setEditingNote({
      index: originalIndex,
      value: content,
      originalValue: content,
      timestamp: timestamp,
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingNote({
      index: null,
      value: "",
      originalValue: "",
      timestamp: "",
    });
  };

  // Save edited note
  const handleSaveEditedNote = async () => {
    if (!editingNote.value.trim()) {
      toast.error("Note cannot be empty");
      return;
    }

    try {
      const lines = noteModal.currentNotes.split(/\r?\n/);

      if (editingNote.timestamp) {
        lines[editingNote.index] = `[${
          editingNote.timestamp
        }] ${editingNote.value.trim()}`;
      } else {
        lines[editingNote.index] = editingNote.value.trim();
      }

      const updatedNotes = lines.join("\n").trim();

      const response = await fetch(
        `/api/contact-detail/${noteModal.contactId}/note`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ notes: updatedNotes }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNoteModal((prev) => ({
          ...prev,
          currentNotes: data.contact.agent_notes || "",
        }));
        handleCancelEdit();
        toast.success("Note updated successfully!");
        await fetchContacts();
      } else {
        toast.error("Failed to update note");
      }
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Failed to update note");
    }
  };

  // Note handling functions
  const handleAddNote = (contact) => {
    // Get the latest contact data from state to ensure we have updated notes
    const latestContact = contacts.find((c) => c.id === contact.id) || contact;
    setNoteModal({
      isOpen: true,
      contactId: latestContact.id,
      contactName: latestContact.name,
      currentNotes: latestContact.agent_notes || "",
      newNote: "",
    });
  };

  const closeNoteModal = () => {
    setNoteModal({
      isOpen: false,
      contactId: null,
      contactName: "",
      currentNotes: "",
      newNote: "",
    });
    handleCancelEdit();
  };

  const handleSaveNote = async () => {
    if (!noteModal.newNote.trim()) {
      toast.error("Please enter a note");
      return;
    }

    try {
      const response = await fetch(
        `/api/contacts/${noteModal.contactId}/note`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ note: noteModal.newNote.trim() }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Update the contact in the local state
        setContacts((prevContacts) =>
          prevContacts.map((contact) =>
            contact.id === noteModal.contactId
              ? { ...contact, agent_notes: data.contact.agent_notes }
              : contact
          )
        );

        // Update note modal to show the saved note immediately
        setNoteModal((prev) => ({
          ...prev,
          currentNotes: data.contact.agent_notes || "",
          newNote: "", // Clear the new note input
        }));

        toast.success("Note saved successfully!");

        // Force-refresh contacts from server to guarantee persistence
        try {
          await fetchContacts();
        } catch (e) {
          // non-blocking
        }

        // Don't close modal - keep it open so user can see the saved note
        // closeNoteModal();
      } else {
        toast.error(data.error || "Failed to save note");
      }
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
    }
  };

  // Get status badge component
  const getStatusBadge = (status, contactId) => {
    const statusConfig = {
      Completed: {
        icon: CheckCircle,
        color: "bg-green-100 text-green-800 border-green-200",
        iconColor: "text-green-600",
        label: "Completed",
      },
      "In Progress": {
        icon: callingContacts.has(contactId) ? Loader : Clock,
        color: callingContacts.has(contactId)
          ? "bg-blue-100 text-blue-800 border-blue-200"
          : "bg-yellow-100 text-yellow-800 border-yellow-200",
        iconColor: callingContacts.has(contactId)
          ? "text-blue-600"
          : "text-yellow-600",
        label: callingContacts.has(contactId) ? "Calling..." : "In Progress",
      },
      Busy: {
        icon: Phone,
        color: "bg-orange-100 text-orange-800 border-orange-200",
        iconColor: "text-orange-600",
        label: "Busy",
      },
      "No Answer": {
        icon: AlertCircle,
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        iconColor: "text-yellow-600",
        label: "No Answer",
      },
      "Switched Off": {
        icon: XCircle,
        color: "bg-gray-100 text-gray-800 border-gray-200",
        iconColor: "text-gray-600",
        label: "Switched Off",
      },
      Cancelled: {
        icon: XCircle,
        color: "bg-red-100 text-red-800 border-red-200",
        iconColor: "text-red-600",
        label: "Cancelled",
      },
      Failed: {
        icon: XCircle,
        color: "bg-red-100 text-red-800 border-red-200",
        iconColor: "text-red-600",
        label: "Failed",
      },
      "Not Called": {
        icon: AlertCircle,
        color: "bg-gray-100 text-gray-800 border-gray-200",
        iconColor: "text-gray-600",
        label: "Not Called",
      },
    };

    const config = statusConfig[status] || statusConfig["Not Called"];
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}
      >
        <Icon
          className={`w-3 h-3 ${config.iconColor} ${
            callingContacts.has(contactId) ? "animate-spin" : ""
          }`}
        />
        {config.label}
      </span>
    );
  };

  // Format schedule time
  const formatScheduleTime = (scheduleTime, lastAttempt, createdAt) => {
    // Use schedule_time if available, otherwise use last_attempt, then createdAt
    const timeToFormat = scheduleTime || lastAttempt || createdAt;

    if (!timeToFormat) return "Not scheduled";

    try {
      const date = new Date(timeToFormat);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (error) {
      return "Invalid date";
    }
  };

  // Format last attempt time
  const formatLastAttempt = (lastAttempt) => {
    if (!lastAttempt) return null;

    try {
      const date = new Date(lastAttempt);
      const now = new Date();
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));

      if (diffInMinutes < 1) return "Just now";
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return date.toLocaleDateString();
    } catch (error) {
      return null;
    }
  };

  // Format duration helper
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Check if call button should be disabled
  const isCallDisabled = (contactId, status) => {
    // Only disable if currently calling (to prevent multiple simultaneous calls)
    return callingContacts.has(contactId);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Call Management
          </h3>
          <p className="text-sm text-gray-600">
            Live contact status and calling interface
          </p>
        </div>
        <TableSkeleton rows={8} columns={8} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Call Management
            </h3>
            <p className="text-sm text-gray-600">
              Live contact status and calling interface •{" "}
              {filteredContacts.length} contacts
              {(dateFilter || storeFilter !== "all") &&
                ` (filtered from ${contacts.length} total)`}
            </p>
          </div>
        </div>
      </div>

      {/* Date Filter Section */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Filter by Date:
              </span>
            </div>

            {/* Date Range Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDateRangeChange("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dateRange === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleDateRangeChange("today")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dateRange === "today"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => handleDateRangeChange("yesterday")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dateRange === "yesterday"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                Yesterday
              </button>
            </div>

            {/* Select Date Picker */}
            <div className="relative" data-date-picker>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                <Calendar className="w-4 h-4" />
                Select Date
              </button>

              {showDatePicker && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    backgroundColor: "white",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    boxShadow:
                      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                    minWidth: "320px",
                  }}
                  data-date-picker
                >
                  <div style={{ padding: "16px" }}>
                    {/* Calendar Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "16px",
                      }}
                    >
                      <button
                        onClick={() => {
                          const newDate = new Date(currentMonth);
                          newDate.setMonth(newDate.getMonth() - 1);
                          setCurrentMonth(newDate);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ChevronLeft
                          className="w-4 h-4"
                          style={{ color: "#4b5563" }}
                        />
                      </button>
                      <div style={{ textAlign: "center" }}>
                        <h3
                          style={{
                            fontSize: "16px",
                            fontWeight: "600",
                            color: "#111827",
                          }}
                        >
                          {currentMonth.toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </h3>
                        <p style={{ fontSize: "12px", color: "#6b7280" }}>
                          Indian Standard Time (IST)
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const newDate = new Date(currentMonth);
                          newDate.setMonth(newDate.getMonth() + 1);
                          setCurrentMonth(newDate);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ChevronRight
                          className="w-4 h-4"
                          style={{ color: "#4b5563" }}
                        />
                      </button>
                    </div>

                    {/* Calendar Days */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: "4px",
                        marginBottom: "16px",
                      }}
                    >
                      {/* Day Headers */}
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                          <div
                            key={day}
                            style={{
                              padding: "8px 4px",
                              textAlign: "center",
                              fontSize: "12px",
                              fontWeight: "500",
                              color: "#6b7280",
                              backgroundColor: "#f9fafb",
                            }}
                          >
                            {day}
                          </div>
                        )
                      )}

                      {/* Calendar Days */}
                      {generateCalendarDays().map((dayData, index) => {
                        const isSelected =
                          dateFilter &&
                          dayData.date.toDateString() ===
                            new Date(dateFilter).toDateString();
                        const isToday =
                          dayData.date.toDateString() ===
                          new Date().toDateString();
                        const isFuture = dayData.date > new Date();
                        const isCurrentMonth = dayData.isCurrentMonth;

                        return (
                          <button
                            key={index}
                            onClick={() => {
                              if (!isFuture && isCurrentMonth) {
                                handleCustomDateChange(dayData.date);
                              }
                            }}
                            disabled={isFuture || !isCurrentMonth}
                            style={{
                              padding: "8px 4px",
                              border: "none",
                              backgroundColor: isSelected
                                ? "#3b82f6"
                                : isToday
                                ? "#eff6ff"
                                : dayData.hasContacts
                                ? "#f0fdf4"
                                : isFuture
                                ? "#f9fafb"
                                : "transparent",
                              color: isSelected
                                ? "white"
                                : isFuture
                                ? "#d1d5db"
                                : isCurrentMonth
                                ? "#111827"
                                : "#9ca3af",
                              cursor: isFuture ? "not-allowed" : "pointer",
                              borderRadius: "4px",
                              fontSize: "14px",
                              fontWeight: isToday ? "600" : "400",
                              position: "relative",
                              minHeight: "32px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: isFuture ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected && !isFuture) {
                                e.target.style.backgroundColor = isCurrentMonth
                                  ? "#f3f4f6"
                                  : "#f9fafb";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected && !isFuture) {
                                e.target.style.backgroundColor = isToday
                                  ? "#eff6ff"
                                  : dayData.hasContacts
                                  ? "#f0fdf4"
                                  : "transparent";
                              }
                            }}
                          >
                            {dayData.date.getDate()}
                            {!isSelected && !isFuture && isCurrentMonth && (
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: "2px",
                                  width: "4px",
                                  height: "4px",
                                  backgroundColor: dayData.hasContacts
                                    ? "#10b981" // green dot when data present
                                    : "#ef4444", // red dot when no data
                                  borderRadius: "50%",
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Calendar Footer */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "12px",
                        borderTop: "1px solid #e5e7eb",
                      }}
                    >
                      <button
                        onClick={() => {
                          const today = new Date();
                          handleCustomDateChange(today);
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: "500",
                          borderRadius: "6px",
                          border: "1px solid #d1d5db",
                          backgroundColor: "#f9fafb",
                          color: "#374151",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = "#f3f4f6";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = "#f9fafb";
                        }}
                      >
                        Today (IST)
                      </button>
                      <button
                        onClick={clearDateFilter}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: "500",
                          borderRadius: "6px",
                          border: "1px solid #dc2626",
                          backgroundColor: "#dc2626",
                          color: "white",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = "#b91c1c";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = "#dc2626";
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Filter Display */}
          {dateFilter && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Showing contacts from:{" "}
                {new Date(dateFilter).toLocaleDateString()}
              </span>
              <button
                onClick={clearDateFilter}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            </div>
          )}

          {/* Store Filter */}
          {uniqueStores.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Store:
              </label>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                <option value="all">All Stores</option>
                {uniqueStores.map((store) => (
                  <option key={store} value={store}>
                    {store}
                  </option>
                ))}
              </select>
              {storeFilter !== "all" && (
                <button
                  onClick={() => setStoreFilter("all")}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {filteredContacts.length === 0 ? (
        <EmptyStates.NoContacts />
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table
            className="w-full table-fixed divide-y divide-gray-200"
            style={{ tableLayout: "fixed" }}
          >
            <thead className="bg-gray-50">
              <tr>
                <th className="w-48 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="w-44 pl-4 pr-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="w-56 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="w-24 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="w-56 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="w-36 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Time
                </th>
                <th className="w-28 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="w-20 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Attempts
                </th>
                <th className="w-40 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedContacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                  style={{ height: "auto" }}
                >
                  {/* Name */}
                  <td className="w-48 px-4 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {contact.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3 min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {contact.name || "Unknown"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="w-44 pl-4 pr-1 py-4">
                    <div className="text-sm text-gray-900 font-mono">
                      {contact.phone || "N/A"}
                    </div>
                  </td>

                  {/* Product */}
                  <td className="w-56 px-4 py-4">
                    {contact.product_name ? (
                      <div
                        className="text-sm text-gray-700 truncate"
                        title={contact.product_name}
                      >
                        {contact.product_name}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>

                  {/* Price */}
                  <td className="w-24 px-4 py-4 text-center">
                    {contact.price ? (
                      <div className="text-sm font-medium text-green-600">
                        ₹{contact.price}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>

                  {/* Address */}
                  <td className="w-56 px-4 py-4">
                    {contact.address ? (
                      <div
                        className="text-sm text-gray-700 truncate"
                        title={contact.address}
                      >
                        {contact.address}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>

                  {/* Schedule Time */}
                  <td className="w-36 px-4 py-4 hidden lg:table-cell">
                    <div className="text-sm text-gray-900">
                      {formatScheduleTime(
                        contact.schedule_time,
                        contact.last_attempt,
                        contact.createdAt
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="w-28 px-4 py-4 text-center">
                    <div className="flex justify-center">
                      {getStatusBadge(contact.status, contact.id)}
                    </div>
                  </td>

                  {/* Attempts */}
                  <td className="w-20 px-4 py-4 text-center hidden md:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {contact.attempts || 0}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="w-40 px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {/* Call Button */}
                      <button
                        onClick={() => handleCall(contact.id, contact.name)}
                        disabled={isCallDisabled(contact.id, contact.status)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors duration-150 ${
                          isCallDisabled(contact.id, contact.status)
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
                        }`}
                      >
                        {callingContacts.has(contact.id) ? (
                          <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                          <Phone className="w-3 h-3" />
                        )}
                        <span className="hidden sm:inline">
                          {callingContacts.has(contact.id)
                            ? "Calling..."
                            : "Call"}
                        </span>
                      </button>

                      {/* Note Button */}
                      <button
                        onClick={() => handleAddNote(contact)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 transition-colors duration-150"
                        title="Add note"
                      >
                        <StickyNote className="w-3 h-3" />
                        <span className="hidden sm:inline">Note</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredContacts.length > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{" "}
                <span className="font-medium">
                  {filteredContacts.length === 0 ? 0 : startIndex + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min(endIndex, filteredContacts.length)}
                </span>{" "}
                of{" "}
                <span className="font-medium">{filteredContacts.length}</span>{" "}
                results
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <label htmlFor="itemsPerPage" className="text-sm text-gray-700">
                  Show:
                </label>
                <select
                  id="itemsPerPage"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="block w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <ChevronLeft className="h-4 w-4 -ml-1" />
                </button>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium border ${
                        currentPage === pageNum
                          ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                          : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4 -ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        isLoading={callingContacts.size > 0}
      />

      {/* Call Modal */}
      <CallModal
        isOpen={callModal.isOpen}
        onClose={handleCallModalClose}
        contact={callModal.contact}
        callStatus={callModal.callStatus}
        callDuration={callModal.callDuration}
      />

      {/* Note Modal */}
      {noteModal.isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={closeNoteModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <StickyNote className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Notes – {noteModal.contactName}
                </h3>
              </div>
              <button
                onClick={closeNoteModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto">
              {/* Current Notes Display */}
              {noteModal.currentNotes && noteModal.currentNotes.trim() && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    All Notes:
                  </label>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg shadow-sm p-4 max-h-72 overflow-y-auto">
                    {formatNotesForDisplay(noteModal.currentNotes).map(
                      (item, index) => {
                        if (item.type === "separator") {
                          return (
                            <hr
                              key={`sep-${index}`}
                              className="my-3 border-gray-300"
                            />
                          );
                        }
                        if (item.type === "header") {
                          return (
                            <h4
                              key={`header-${index}`}
                              className="text-sm font-bold text-gray-900 mt-2 mb-3 first:mt-0 flex items-center gap-2"
                            >
                              <div className="w-1 h-4 bg-blue-600 rounded"></div>
                              {item.content}
                            </h4>
                          );
                        }
                        if (item.type === "excel") {
                          return (
                            <div key={`excel-${index}`} className="mb-3">
                              <div className="text-xs font-semibold text-blue-700 mb-1">
                                {item.label}
                              </div>
                              <div className="text-xs text-gray-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                                {item.content.split(",").map((part, i) => (
                                  <div key={i} className="mb-1 last:mb-0">
                                    <span className="text-gray-600">
                                      {part.trim()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        if (item.type === "note") {
                          const isEditing =
                            editingNote.index === item.originalIndex;
                          return (
                            <div
                              key={`note-${index}`}
                              className="mb-3 pb-3 border-b border-gray-200 last:border-0 last:mb-0 last:pb-0 group hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors duration-150"
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-medium text-gray-500 whitespace-nowrap min-w-[140px] pt-1">
                                      {item.timestamp}
                                    </span>
                                    <input
                                      type="text"
                                      value={editingNote.value}
                                      onChange={(e) =>
                                        setEditingNote((prev) => ({
                                          ...prev,
                                          value: e.target.value,
                                        }))
                                      }
                                      className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          handleSaveEditedNote();
                                        } else if (e.key === "Escape") {
                                          handleCancelEdit();
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-end gap-2 ml-[148px]">
                                    <button
                                      onClick={handleCancelEdit}
                                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-150"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleSaveEditedNote}
                                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150 inline-flex items-center gap-1"
                                    >
                                      <Save className="w-3 h-3" />
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-3">
                                  <span className="text-xs font-medium text-gray-500 whitespace-nowrap min-w-[140px] pt-0.5">
                                    {item.timestamp}
                                  </span>
                                  <span className="text-sm text-gray-800 flex-1 pt-0.5">
                                    {item.content}
                                  </span>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <button
                                      onClick={() =>
                                        handleStartEditNote(
                                          item.originalIndex,
                                          item.timestamp,
                                          item.content
                                        )
                                      }
                                      className="p-1.5 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150"
                                      title="Edit note"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteNote(item.originalIndex)
                                      }
                                      className="p-1.5 text-red-600 bg-red-50 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-150"
                                      title="Delete note"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (item.type === "text") {
                          return (
                            <div
                              key={`text-${index}`}
                              className="mb-2 text-sm text-gray-700"
                            >
                              {item.content}
                            </div>
                          );
                        }
                        return null;
                      }
                    )}
                  </div>
                </div>
              )}

              {/* New Note Input */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Add New Note:
                </label>
                <textarea
                  value={noteModal.newNote}
                  onChange={(e) =>
                    setNoteModal((prev) => ({
                      ...prev,
                      newNote: e.target.value,
                    }))
                  }
                  placeholder="Type your note here..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none transition-all duration-150 shadow-sm"
                  rows={4}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closeNoteModal}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                disabled={!noteModal.newNote.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-600 to-amber-700 border border-transparent rounded-lg hover:from-amber-700 hover:to-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-150 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallTable;
