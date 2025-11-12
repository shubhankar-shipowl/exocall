import React, { useState, useEffect } from 'react';
import {
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Calendar,
  Download,
  Play,
  ChevronLeft,
  ChevronRight,
  Trash2,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  getIndianDate,
  toIndianDate,
  formatIndianDate,
  formatIndianDateTime,
  isTodayInIndia,
  getYesterdayInIndia,
  getTomorrowInIndia,
  getCurrentIndianDate,
} from '../utils/timezone';
import { toast } from 'react-toastify';
import ConfirmationModal from '../components/ConfirmationModal';
import { EmptyStates } from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { useAuth } from '../contexts/AuthContext';

const CallLogs = () => {
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState('all');
  const [remarkFilter, setRemarkFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [calls, setCalls] = useState([]);
  const [availableStores, setAvailableStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingRecording, setPlayingRecording] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Confirmation modal states
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    type: 'warning',
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    confirmButtonColor: '#3b82f6',
  });

  // Handle play recording
  const handlePlayRecording = (callId, recordingUrl) => {
    console.log('🎵 Play button clicked:', { callId, recordingUrl });

    if (!recordingUrl) {
      console.error('❌ No recording URL available');
      toast.error('No recording available for this call');
      return;
    }

    if (playingRecording === callId) {
      // If already playing this recording, stop it
      console.log('⏹️  Stopping playback');
      setPlayingRecording(null);
    } else {
      // Play the selected recording
      console.log('▶️  Starting playback for:', callId);
      setPlayingRecording(callId);
    }
  };

  // Fetch call logs from API
  const fetchCallLogs = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Fetch all call logs by setting a very high limit
      const response = await fetch('/api/reports/logs?limit=10000', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Call Logs Response:', data.data.callLogs);
        const callLogs = data.data.callLogs.map((log) => {
          console.log('🔍 Processing call log:', {
            id: log.id,
            status: log.status,
            recording_url: log.recording_url,
            has_recording: !!log.recording_url,
          });

          return {
            id: log.id,
            contact: log.contact?.name || 'Unknown',
            phone: log.contact?.phone || 'N/A',
            status: log.status,
            duration: log.duration
              ? `${Math.floor(log.duration / 60)}:${(log.duration % 60)
                  .toString()
                  .padStart(2, '0')}`
              : '0:00',
            attempts: log.attempt_no || 1,
            timestamp: (() => {
              const date = new Date(log.createdAt);
              // Format: "Oct 27, 6:12 PM"
              return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              });
            })(),
            recording: log.recording_url,
            date: formatIndianDate(new Date(log.createdAt)),
            remark: log.contact?.remark || '',
            store: log.contact?.store || '',
          };
        });
        console.log('✅ Processed call logs:', callLogs);
        setCalls(callLogs);
        
        // Extract unique stores from call logs
        const stores = [
          ...new Set(
            callLogs
              .map((call) => call.store)
              .filter((store) => store && store.trim() !== '')
          ),
        ].sort();
        setAvailableStores(stores);
      } else {
        toast.error('Failed to fetch call logs');
      }
    } catch (error) {
      console.error('Error fetching call logs:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCallLogs();
  }, []);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCalendar && !event.target.closest('[data-calendar]')) {
        setShowCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  // Filter calls based on status, remark, store, and date
  const filteredCalls = calls.filter((call) => {
    const statusMatch =
      filter === 'all' || (call.status || '').toLowerCase() === filter;
    
    const remarkMatch =
      remarkFilter === 'all' || 
      (remarkFilter === 'accept' && call.remark === 'accept') ||
      (remarkFilter === 'reject' && call.remark === 'reject') ||
      (remarkFilter === 'none' && (!call.remark || call.remark === ''));

    const storeMatch =
      storeFilter === 'all' || 
      (call.store && call.store === storeFilter);

    const dateMatch = !selectedDate || call.date === selectedDate;

    return statusMatch && remarkMatch && storeMatch && dateMatch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCalls = filteredCalls.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, remarkFilter, storeFilter, selectedDate, dateRange]);

  // Clear date filter
  const clearDateFilter = () => {
    setSelectedDate('');
    setDateRange('all');
  };

  // Date range helper functions
  const getDateRangeFilter = (range) => {
    const today = getIndianDate();
    const yesterday = getYesterdayInIndia();

    switch (range) {
      case 'today':
        return formatIndianDate(today);
      case 'yesterday':
        return formatIndianDate(yesterday);
      default:
        return '';
    }
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    if (range === 'all') {
      setSelectedDate('');
    } else {
      const date = getDateRangeFilter(range);
      setSelectedDate(date);
    }
  };

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return (
          <CheckCircle
            style={{ width: '20px', height: '20px', color: '#10b981' }}
          />
        );
      case 'failed':
        return (
          <XCircle
            style={{ width: '20px', height: '20px', color: '#ef4444' }}
          />
        );
      case 'busy':
        return (
          <Phone
            style={{ width: '20px', height: '20px', color: '#f97316' }}
          />
        );
      case 'no answer':
        return (
          <Clock
            style={{ width: '20px', height: '20px', color: '#f59e0b' }}
          />
        );
      case 'switched off':
      case 'switchedoff':
        return (
          <XCircle
            style={{ width: '20px', height: '20px', color: '#8b5cf6' }}
          />
        );
      case 'cancelled':
        return (
          <XCircle
            style={{ width: '20px', height: '20px', color: '#ef4444' }}
          />
        );
      case 'ringing':
        return (
          <Phone
            style={{ width: '20px', height: '20px', color: '#3b82f6' }}
          />
        );
      case 'not connect':
        return (
          <XCircle
            style={{ width: '20px', height: '20px', color: '#6b7280' }}
          />
        );
      case 'in progress':
        return (
          <Clock
            style={{ width: '20px', height: '20px', color: '#3b82f6' }}
          />
        );
      case 'not called':
        return (
          <Clock
            style={{ width: '20px', height: '20px', color: '#9ca3af' }}
          />
        );
      default:
        return (
          <Clock style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
        );
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return { backgroundColor: '#dcfce7', color: '#166534' };
      case 'failed':
        return { backgroundColor: '#fef2f2', color: '#991b1b' };
      case 'busy':
        return { backgroundColor: '#fed7aa', color: '#9a3412' };
      case 'no answer':
        return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'switched off':
      case 'switchedoff':
        return { backgroundColor: '#f3e8ff', color: '#5b21b6' };
      case 'cancelled':
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'ringing':
        return { backgroundColor: '#dbeafe', color: '#1e40af' };
      case 'not connect':
        return { backgroundColor: '#f3f4f6', color: '#374151' };
      case 'in progress':
        return { backgroundColor: '#dbeafe', color: '#1e40af' };
      case 'not called':
        return { backgroundColor: '#f9fafb', color: '#6b7280' };
      default:
        return { backgroundColor: '#fef3c7', color: '#92400e' };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return formatIndianDateTime(date, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calendar utility functions
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getLastDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDay();
  };

  const getDaysInPreviousMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 0).getDate();
  };

  const isToday = (date) => {
    return isTodayInIndia(date);
  };

  const isSelected = (date) => {
    return selectedDate === formatIndianDate(date);
  };

  const hasCallsOnDate = (date) => {
    const dateString = formatIndianDate(date);
    return calls.some((call) => call.date === dateString);
  };

  const isFutureDate = (date) => {
    const today = getIndianDate();
    const dateIST = toIndianDate(date);
    return dateIST > today;
  };

  const navigateMonth = (direction) => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  const selectDate = (date) => {
    // Prevent selection of future dates
    if (isFutureDate(date)) {
      console.log('Cannot select future dates');
      return;
    }

    const dateString = formatIndianDate(date);
    console.log('Selected date:', date, 'Formatted as:', dateString);
    setSelectedDate(dateString);
    setDateRange('custom');
    setShowCalendar(false);
  };

  // Action handlers with confirmation modals
  const handleDeleteCall = (callId, contactName) => {
    setConfirmationModal({
      isOpen: true,
      type: 'danger',
      title: 'Delete Call Record',
      message: `Are you sure you want to delete the call record for ${contactName}? This action cannot be undone.`,
      onConfirm: () => confirmDeleteCall(callId),
      confirmText: 'Delete',
      confirmButtonColor: '#ef4444',
    });
  };

  const confirmDeleteCall = async (callId) => {
    try {
      const response = await fetch(`/api/calls/${callId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setCalls((prevCalls) => prevCalls.filter((call) => call.id !== callId));
        toast.success('Call record deleted successfully');
        // Refresh the data to ensure consistency
        fetchCallLogs();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete call record');
      }
    } catch (error) {
      console.error('Error deleting call record:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleRetryCall = (callId, contactName) => {
    setConfirmationModal({
      isOpen: true,
      type: 'warning',
      title: 'Retry Call',
      message: `Are you sure you want to retry the call for ${contactName}? This will reset the call status and attempt again.`,
      onConfirm: () => confirmRetryCall(callId),
      confirmText: 'Retry',
      confirmButtonColor: '#f59e0b',
    });
  };

  const confirmRetryCall = async (callId) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setCalls((prevCalls) =>
        prevCalls.map((call) =>
          call.id === callId
            ? { ...call, status: 'pending', duration: '0:00' }
            : call,
        ),
      );
      toast.success('Call retry initiated successfully');
    } catch (error) {
      toast.error('Failed to retry call');
    } finally {
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleExportCall = (callId, contactName) => {
    // Simulate export functionality
    toast.info(`Exporting call record for ${contactName}...`);
    // Add actual export logic here
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const lastDay = getLastDayOfMonth(currentMonth);
    const daysInPrevMonth = getDaysInPreviousMonth(currentMonth);

    const days = [];

    // Previous month's trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        daysInPrevMonth - i,
      );
      days.push({
        date,
        isCurrentMonth: false,
        isToday: isToday(date),
        isSelected: isSelected(date),
        hasCalls: hasCallsOnDate(date),
      });
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day,
      );
      days.push({
        date,
        isCurrentMonth: true,
        isToday: isToday(date),
        isSelected: isSelected(date),
        hasCalls: hasCallsOnDate(date),
      });
    }

    // Next month's leading days
    for (let day = 1; day <= 6 - lastDay; day++) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        day,
      );
      days.push({
        date,
        isCurrentMonth: false,
        isToday: isToday(date),
        isSelected: isSelected(date),
        hasCalls: hasCallsOnDate(date),
      });
    }

    return days;
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '30px',
            fontWeight: 'bold',
            color: '#111827',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Phone style={{ width: '32px', height: '32px' }} />
          Call Logs
        </h1>
        <p
          style={{
            color: '#6b7280',
            margin: '8px 0 0 0',
            fontSize: '16px',
          }}
        >
          View and manage your call history with date filtering
        </p>
      </div>

      {/* Filters Section */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <h3
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Filter style={{ width: '20px', height: '20px' }} />
            Filters
          </h3>
          <div
            style={{
              fontSize: '14px',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock style={{ width: '16px', height: '16px' }} />
            {filteredCalls.length} calls found
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Status Filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Status
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
              }}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="busy">Busy</option>
              <option value="no answer">No Answer</option>
              <option value="switched off">Switched Off</option>
              <option value="cancelled">Cancelled</option>
              <option value="ringing">Ringing</option>
              <option value="not connect">Not Connect</option>
              <option value="in progress">In Progress</option>
              <option value="not called">Not Called</option>
            </select>
          </div>

          {/* Remark Filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Remark
            </label>
            <select
              value={remarkFilter}
              onChange={(e) => setRemarkFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
              }}
            >
              <option value="all">All</option>
              <option value="accept">Accept</option>
              <option value="reject">Reject</option>
              <option value="none">No Remark</option>
            </select>
          </div>

          {/* Store Filter */}
          {availableStores.length > 0 && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                Store
              </label>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
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
          )}

          {/* Date Range Filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Date Range
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleDateRangeChange('all')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: dateRange === 'all' ? '#3b82f6' : 'white',
                  color: dateRange === 'all' ? 'white' : '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (dateRange !== 'all') {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (dateRange !== 'all') {
                    e.target.style.backgroundColor = 'white';
                  }
                }}
              >
                All
              </button>
              <button
                onClick={() => handleDateRangeChange('today')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: dateRange === 'today' ? '#3b82f6' : 'white',
                  color: dateRange === 'today' ? 'white' : '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (dateRange !== 'today') {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (dateRange !== 'today') {
                    e.target.style.backgroundColor = 'white';
                  }
                }}
              >
                Today
              </button>
              <button
                onClick={() => handleDateRangeChange('yesterday')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor:
                    dateRange === 'yesterday' ? '#3b82f6' : 'white',
                  color: dateRange === 'yesterday' ? 'white' : '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (dateRange !== 'yesterday') {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (dateRange !== 'yesterday') {
                    e.target.style.backgroundColor = 'white';
                  }
                }}
              >
                Yesterday
              </button>
            </div>
          </div>

          {/* Calendar Date Picker */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Select Date
            </label>
            <div style={{ position: 'relative' }} data-calendar>
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <span>
                  {selectedDate ? formatDate(selectedDate) : 'Choose a date'}
                </span>
                <Calendar
                  style={{ width: '16px', height: '16px', color: '#6b7280' }}
                />
              </button>

              {/* Calendar Dropdown */}
              {showCalendar && (
                <div
                  data-calendar
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow:
                      '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    marginTop: '4px',
                    padding: '16px',
                  }}
                >
                  {/* Calendar Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                    }}
                  >
                    <button
                      onClick={() => navigateMonth(-1)}
                      style={{
                        padding: '4px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ChevronLeft
                        style={{
                          width: '20px',
                          height: '20px',
                          color: '#374151',
                        }}
                      />
                    </button>

                    <div style={{ textAlign: 'center' }}>
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#111827',
                          margin: 0,
                        }}
                      >
                        {currentMonth.toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </h3>
                      <div
                        style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          marginTop: '2px',
                        }}
                      >
                        Indian Standard Time (IST)
                      </div>
                    </div>

                    <button
                      onClick={() => navigateMonth(1)}
                      style={{
                        padding: '4px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ChevronRight
                        style={{
                          width: '20px',
                          height: '20px',
                          color: '#374151',
                        }}
                      />
                    </button>
                  </div>

                  {/* Calendar Days */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, 1fr)',
                      gap: '4px',
                    }}
                  >
                    {/* Day Headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                      (day) => (
                        <div
                          key={day}
                          style={{
                            padding: '8px 4px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#6b7280',
                            backgroundColor: '#f9fafb',
                          }}
                        >
                          {day}
                        </div>
                      ),
                    )}

                    {/* Calendar Days */}
                    {generateCalendarDays().map((dayData, index) => {
                      const isFuture = isFutureDate(dayData.date);
                      return (
                        <button
                          key={index}
                          onClick={() => selectDate(dayData.date)}
                          disabled={isFuture}
                          style={{
                            padding: '8px 4px',
                            border: 'none',
                            backgroundColor: dayData.isSelected
                              ? '#3b82f6'
                              : dayData.isToday
                              ? '#eff6ff'
                              : dayData.hasCalls
                              ? '#f0fdf4'
                              : isFuture
                              ? '#f9fafb'
                              : 'transparent',
                            color: dayData.isSelected
                              ? 'white'
                              : isFuture
                              ? '#d1d5db'
                              : dayData.isCurrentMonth
                              ? '#111827'
                              : '#9ca3af',
                            cursor: isFuture ? 'not-allowed' : 'pointer',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: dayData.isToday ? '600' : '400',
                            position: 'relative',
                            minHeight: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isFuture ? 0.5 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!dayData.isSelected && !isFuture) {
                              e.target.style.backgroundColor =
                                dayData.isCurrentMonth ? '#f3f4f6' : '#f9fafb';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!dayData.isSelected && !isFuture) {
                              e.target.style.backgroundColor = dayData.isToday
                                ? '#eff6ff'
                                : dayData.hasCalls
                                ? '#f0fdf4'
                                : 'transparent';
                            }
                          }}
                        >
                          {dayData.date.getDate()}
                          {!dayData.isSelected && !isFuture && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '2px',
                                width: '4px',
                                height: '4px',
                                backgroundColor: dayData.hasCalls
                                  ? '#10b981' // green when data exists
                                  : '#ef4444', // red when no data
                                borderRadius: '50%',
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
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <button
                      onClick={() => {
                        const today = getIndianDate();
                        selectDate(today);
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                    >
                      Today (IST)
                    </button>
                    <button
                      onClick={clearDateFilter}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clear Filters */}
          {(selectedDate || filter !== 'all' || remarkFilter !== 'all' || storeFilter !== 'all') && (
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                onClick={() => {
                  setFilter('all');
                  setRemarkFilter('all');
                  setStoreFilter('all');
                  clearDateFilter();
                }}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <XCircle style={{ width: '16px', height: '16px' }} />
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {(selectedDate || filter !== 'all' || remarkFilter !== 'all' || storeFilter !== 'all') && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}
            >
              Active filters:
            </span>
            {filter !== 'all' && (
              <span
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                Status: {filter}
              </span>
            )}
            {remarkFilter !== 'all' && (
              <span
                style={{
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                Remark: {remarkFilter === 'accept' ? 'Accept' : remarkFilter === 'reject' ? 'Reject' : 'No Remark'}
              </span>
            )}
            {storeFilter !== 'all' && (
              <span
                style={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                Store: {storeFilter}
              </span>
            )}
            {selectedDate && (
              <span
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                Date: {formatDate(selectedDate)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Call Logs Table */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}
        >
          <h3
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Calendar style={{ width: '20px', height: '20px' }} />
            Call History
          </h3>
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : filteredCalls.length === 0 ? (
          <EmptyStates.NoCalls />
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Time
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Call Duration
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attempts
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remark
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex justify-end">Actions</div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedCalls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    {/* Contact */}
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Phone className="w-4 h-4 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {call.contact}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 font-mono">
                        {call.phone}
                      </div>
                    </td>

                    {/* Time */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {call.timestamp}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex justify-center">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
                          style={getStatusColor(call.status)}
                        >
                          {getStatusIcon(call.status)}
                          {call.status}
                        </span>
                      </div>
                    </td>

                    {/* Call Duration */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        {call.recording &&
                        call.duration !== '0:00' &&
                        call.duration !== 0 ? (
                          <>
                            <button
                              onClick={() => {
                                if (call.recording) {
                                  window.open(
                                    call.recording,
                                    '_blank',
                                    'noopener,noreferrer',
                                  );
                                } else {
                                  toast.error('No recording available');
                                }
                              }}
                              className="inline-flex items-center justify-center p-1.5 rounded-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Open Recording in New Tab"
                            >
                              <Play className="w-3 h-3" />
                            </button>
                            <div className="text-sm text-gray-900 font-mono">
                              {call.duration || '0:00'}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-900 font-mono">
                            {call.duration || '0:00'}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Attempts */}
                    <td className="px-4 py-4 text-center">
                      <div className="inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {call.attempts || 1}
                      </div>
                    </td>

                    {/* Remark (display only - from contact) */}
                    <td className="px-4 py-4 text-center">
                      <div className="inline-flex items-center gap-2 justify-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            call.remark === 'accept'
                              ? 'bg-green-500'
                              : call.remark === 'reject'
                              ? 'bg-red-500'
                              : 'bg-gray-300'
                          }`}
                        />
                        <span className="text-xs font-medium text-gray-700">
                          {call.remark === 'accept'
                            ? 'Accept'
                            : call.remark === 'reject'
                            ? 'Reject'
                            : '-'}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {call.status === 'failed' && (
                            <button
                              onClick={() =>
                                handleRetryCall(call.id, call.contact)
                              }
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-md hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 transition-colors duration-150"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span className="hidden sm:inline">Retry</span>
                            </button>
                          )}

                          <button
                            onClick={() =>
                              handleDeleteCall(call.id, call.contact)
                            }
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors duration-150"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredCalls.length > 0 && (
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
                  Showing{' '}
                  <span className="font-medium">
                    {filteredCalls.length === 0 ? 0 : startIndex + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(endIndex, filteredCalls.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredCalls.length}</span>{' '}
                  results
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="itemsPerPage"
                    className="text-sm text-gray-700"
                  >
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
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
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
      />
    </div>
  );
};

export default CallLogs;
