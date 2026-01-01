import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  Shield,
  User,
  Calendar,
  Mail,
  MoreVertical,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  EyeOff,
  Lock,
  ClipboardList,
  Package,
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import {
  getIndianDate,
  formatIndianDate,
  isTodayInIndia,
  getYesterdayInIndia,
} from "../utils/timezone";

const UserManagement = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "agent",
  });
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [allContacts, setAllContacts] = useState([]); // All contacts for calendar dots
  const [contacts, setContacts] = useState([]); // Filtered contacts for assignment list
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [filters, setFilters] = useState({
    store: "",
    product_name: "",
    date: "",
  });
  const [availableStores, setAvailableStores] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState("all");
  const [datePickerPosition, setDatePickerPosition] = useState({ top: 0, left: 0, width: 0 });
  const [showAssignmentsView, setShowAssignmentsView] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [unassignedContacts, setUnassignedContacts] = useState([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchUserStats();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/users/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserStats(data);
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user role");
      }

      toast.success("User role updated successfully");
      fetchUsers();
      setShowRoleModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error(error.message || "Failed to update user role");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete user");
      }

      toast.success("User deleted successfully");
      fetchUsers();
      fetchUserStats();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(newUser.username)) {
      toast.error(
        "Username must be 3-30 characters long and contain only letters, numbers, and underscores"
      );
      return;
    }

    // Validate password length
    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      toast.success("Agent created successfully");
      setShowCreateModal(false);
      setNewUser({
        username: "",
        email: "",
        password: "",
        role: "agent",
      });
      fetchUsers();
      fetchUserStats();
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/users/${editingUser.id}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      toast.success("Password updated successfully");
      setShowPasswordModal(false);
      setNewPassword("");
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleOpenAssignmentModal = async (agent) => {
    setSelectedAgent(agent);
    setShowAssignmentModal(true);
    setSelectedContacts(new Set());
    setFilters({ store: "", product_name: "", date: "" });
    setCurrentMonth(new Date());
    setShowDatePicker(false);
    setDateRange("all");
    await fetchContactsForAssignment();
  };

  // Fetch all contacts for calendar dots (same as CallTable)
  const fetchAllContacts = async () => {
    try {
      const token = localStorage.getItem("token");
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/contacts?t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const contactsArray = Array.isArray(data) ? data : [];
        setAllContacts(contactsArray);
      } else {
        console.error("Failed to fetch all contacts");
        setAllContacts([]);
      }
    } catch (error) {
      console.error("Error fetching all contacts:", error);
      setAllContacts([]);
    }
  };

  // Filter contacts based on filters (same logic as CallTable)
  const filterContacts = () => {
    let filtered = [...allContacts];

    // Date filter
    if (filters.date) {
      filtered = filtered.filter((contact) => {
        const contactDate = contact.createdAt || contact.created_at;
        if (!contactDate) return false;
        return isDateInRange(contactDate, filters.date);
      });
    }

    // Store filter
    if (filters.store) {
      filtered = filtered.filter((contact) => {
        return contact.store && contact.store === filters.store;
      });
    }

    // Product filter
    if (filters.product_name) {
      filtered = filtered.filter((contact) => {
        return contact.product_name && contact.product_name === filters.product_name;
      });
    }

    setContacts(filtered);

    // Extract unique stores and products from date-filtered contacts (same as CallTable)
    const dateFilteredContacts = filters.date
      ? allContacts.filter((contact) => {
          const contactDate = contact.createdAt || contact.created_at;
          if (!contactDate) return false;
          return isDateInRange(contactDate, filters.date);
        })
      : allContacts;

    const stores = [
      ...new Set(dateFilteredContacts.map((c) => c.store).filter(Boolean)),
    ].sort();
    const products = [
      ...new Set(
        dateFilteredContacts
          .filter((c) => !filters.store || c.store === filters.store)
          .map((c) => c.product_name)
          .filter(Boolean)
      ),
    ].sort();

    setAvailableStores(stores);
    setAvailableProducts(products);
  };

  const fetchContactsForAssignment = async () => {
    setIsLoadingContacts(true);
    try {
      // Fetch all contacts first (for calendar)
      await fetchAllContacts();
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Network error. Please try again.");
      setAllContacts([]);
      setContacts([]);
      setAvailableStores([]);
      setAvailableProducts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Fetch all contacts when modal opens
  useEffect(() => {
    if (showAssignmentModal) {
      fetchContactsForAssignment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAssignmentModal]);

  // Filter contacts when filters change (same as CallTable)
  useEffect(() => {
    if (showAssignmentModal && allContacts.length > 0) {
      filterContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.store, filters.product_name, filters.date, allContacts, showAssignmentModal]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDatePicker && !event.target.closest('[data-date-picker]')) {
        setShowDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  // Date filtering helper functions (same as CallTable)
  const formatDate = (dateInput) => {
    if (!dateInput) return '';

    let date;
    if (dateInput instanceof Date) {
      date = new Date(dateInput);
    } else {
      date = new Date(dateInput);
    }

    // Format as YYYY-MM-DD using local date (not UTC)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

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
      case 'today':
        return formatDate(today);
      case 'yesterday':
        return formatDate(yesterday);
      default:
        return '';
    }
  };

  // Check if contacts exist on a specific date (same as CallTable - uses allContacts)
  const hasContactsOnDate = (date) => {
    if (!allContacts || allContacts.length === 0) return false;

    const dateString = formatDate(date);
    return allContacts.some((contact) => {
      const contactDate = contact.createdAt || contact.created_at;
      if (!contactDate) return false;
      return formatDate(contactDate) === dateString;
    });
  };

  // Date picker handlers
  const handleDateRangeChange = (range) => {
    setDateRange(range);
    if (range === 'all') {
      setFilters({ ...filters, date: '' });
    } else {
      const date = getDateRangeFilter(range);
      setFilters({ ...filters, date });
    }
    setShowDatePicker(false);
  };

  const handleCustomDateChange = (date) => {
    const formattedDate = formatDate(date);
    setFilters({ ...filters, date: formattedDate });
    setDateRange('custom');
    setShowDatePicker(false);
  };

  // Generate calendar days for the current month (same as CallTable)
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
        filters.date &&
        date.toDateString() === new Date(filters.date).toDateString();

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
    setFilters({ ...filters, date: '' });
    setDateRange('all');
    setShowDatePicker(false);
  };

  const handleToggleContact = (contactId) => {
    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleAssignContacts = async () => {
    if (selectedContacts.size === 0) {
      toast.error("Please select at least one contact");
      return;
    }

    setIsAssigning(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/contacts/assignment/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contactIds: Array.from(selectedContacts),
          agentId: selectedAgent.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign contacts");
      }

      toast.success(
        `Successfully assigned ${data.assignedCount} contact(s) to ${selectedAgent.username}`
      );
      setShowAssignmentModal(false);
      setSelectedAgent(null);
      setSelectedContacts(new Set());
      setFilters({ store: "", product_name: "", date: "" });
      setShowDatePicker(false);
      setDateRange("all");
    } catch (error) {
      console.error("Error assigning contacts:", error);
      toast.error(error.message || "Failed to assign contacts");
    } finally {
      setIsAssigning(false);
    }
  };

  const formatDateForDisplay = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const fetchAssignments = async () => {
    setIsLoadingAssignments(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/contacts/assignment/view", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAssignments(data.assignments || []);
        setUnassignedCount(data.unassignedCount || 0);
        setUnassignedContacts(data.unassignedContacts || []);
      } else {
        toast.error("Failed to fetch assignments");
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  const handleViewAssignments = () => {
    setShowAssignmentsView(true);
    fetchAssignments();
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: {
        bg: "bg-purple-100",
        text: "text-purple-800",
        border: "border-purple-200",
        icon: Shield,
      },
      agent: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        border: "border-blue-200",
        icon: User,
      },
    };

    const style = styles[role] || styles.agent;
    const Icon = style.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}
      >
        <Icon className="w-3 h-3" />
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          User Management
        </h1>
        <p className="text-gray-600">
          Manage user accounts, roles, and permissions
        </p>
      </div>

      {/* Stats Cards */}
      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {userStats.totalUsers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="text-2xl font-bold text-gray-900">
                  {userStats.adminCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Agents</p>
                <p className="text-2xl font-bold text-gray-900">
                  {userStats.agentCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  New This Month
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {userStats.recentUsers}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
          {isAdmin && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleViewAssignments}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                View Assignments
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Create Agent
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.username}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateForDisplay(user.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateForDisplay(user.updatedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {isAdmin && user.role === "agent" && (
                        <button
                          onClick={() => handleOpenAssignmentModal(user)}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Assign Tasks"
                        >
                          <ClipboardList className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setShowRoleModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="Change Role"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setShowPasswordModal(true);
                            setNewPassword("");
                            setShowNewPassword(false);
                          }}
                          className="text-purple-600 hover:text-purple-900 p-1"
                          title="Update Password"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Change User Role
            </h3>
            <p className="text-gray-600 mb-6">
              Change role for <strong>{editingUser.username}</strong>
            </p>

            <div className="space-y-3 mb-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={editingUser.role === "admin"}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value })
                  }
                  className="mr-3"
                />
                <div className="flex items-center">
                  <Shield className="w-4 h-4 text-purple-600 mr-2" />
                  <span className="text-sm font-medium">Admin</span>
                  <span className="text-xs text-gray-500 ml-2">
                    Full system access
                  </span>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="agent"
                  checked={editingUser.role === "agent"}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value })
                  }
                  className="mr-3"
                />
                <div className="flex items-center">
                  <User className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium">Agent</span>
                  <span className="text-xs text-gray-500 ml-2">
                    Limited access
                  </span>
                </div>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setEditingUser(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleRoleChange(editingUser.id, editingUser.role)
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Create New Agent
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUser({
                    username: "",
                    email: "",
                    password: "",
                    role: "agent",
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  3-30 characters, letters, numbers, and underscores only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 6 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewUser({
                      username: "",
                      email: "",
                      password: "",
                      role: "agent",
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCreating}
                >
                  {isCreating ? "Creating..." : "Create Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Password Modal */}
      {showPasswordModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Update Password
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword("");
                  setEditingUser(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              Update password for <strong>{editingUser.username}</strong>
            </p>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 6 characters
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setNewPassword("");
                    setEditingUser(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={isUpdatingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUpdatingPassword}
                >
                  {isUpdatingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignmentModal && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Assign Tasks to {selectedAgent?.username || 'Agent'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Select contacts from multiple products and assign them all at once. Filter by store and product to find contacts.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignmentModal(false);
                  setSelectedAgent(null);
                  setSelectedContacts(new Set());
                  setFilters({ store: "", product_name: "", date: "" });
                  setShowDatePicker(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Date
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => handleDateRangeChange('all')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      dateRange === 'all'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => handleDateRangeChange('today')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      dateRange === 'today'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => handleDateRangeChange('yesterday')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      dateRange === 'yesterday'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    Yesterday
                  </button>
                </div>

                {/* Select Date Picker */}
                <div className="relative" data-date-picker>
                  <button
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const viewportHeight = window.innerHeight;
                      const calendarHeight = 340; // Reduced calendar height
                      const spaceBelow = viewportHeight - rect.bottom;
                      const spaceAbove = rect.top;
                      
                      // Determine if calendar should open above or below
                      let top;
                      if (spaceBelow < calendarHeight && spaceAbove > spaceBelow) {
                        // Open above the button
                        top = rect.top - calendarHeight - 8;
                      } else {
                        // Open below the button
                        top = rect.bottom + 8;
                      }
                      
                      // Clamp to viewport
                      top = Math.max(8, Math.min(viewportHeight - calendarHeight - 8, top));
                      
                      setDatePickerPosition({
                        top,
                        left: rect.left,
                        width: rect.width,
                      });
                      setShowDatePicker(!showDatePicker);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all duration-200 w-full"
                  >
                    <Calendar className="w-4 h-4" />
                    {filters.date
                      ? new Date(filters.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Select Date'}
                  </button>

                  {showDatePicker && (
                    <div
                      style={{
                        position: 'fixed',
                        top: `${datePickerPosition.top}px`,
                        left: `${datePickerPosition.left}px`,
                        width: `${Math.max(datePickerPosition.width, 320)}px`,
                        zIndex: 9999,
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow:
                          '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        minWidth: '320px',
                        maxHeight: '400px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      data-date-picker
                    >
                      <div style={{ padding: '12px', flex: '1', overflow: 'auto' }}>
                        {/* Calendar Header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px',
                          }}
                        >
                          <button
                            onClick={() => {
                              const newDate = new Date(currentMonth);
                              newDate.setMonth(newDate.getMonth() - 1);
                              setCurrentMonth(newDate);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <ChevronLeft
                              className="w-4 h-4"
                              style={{ color: '#4b5563' }}
                            />
                          </button>
                          <div style={{ textAlign: 'center' }}>
                            <h3
                              style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#111827',
                              }}
                            >
                              {currentMonth.toLocaleDateString('en-US', {
                                month: 'long',
                                year: 'numeric',
                              })}
                            </h3>
                            <p style={{ fontSize: '12px', color: '#6b7280' }}>
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
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <ChevronRight
                              className="w-4 h-4"
                              style={{ color: '#4b5563' }}
                            />
                          </button>
                        </div>

                        {/* Calendar Days */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            gap: '4px',
                            marginBottom: '12px',
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
                                  fontWeight: '500',
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
                            const isSelected =
                              filters.date &&
                              dayData.date.toDateString() ===
                                new Date(filters.date).toDateString();
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
                                  padding: '8px 4px',
                                  border: 'none',
                                  backgroundColor: isSelected
                                    ? '#3b82f6'
                                    : isToday
                                    ? '#eff6ff'
                                    : dayData.hasContacts
                                    ? '#f0fdf4'
                                    : isFuture
                                    ? '#f9fafb'
                                    : 'transparent',
                                  color: isSelected
                                    ? 'white'
                                    : isFuture
                                    ? '#d1d5db'
                                    : isCurrentMonth
                                    ? '#111827'
                                    : '#9ca3af',
                                  cursor: isFuture ? 'not-allowed' : 'pointer',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  fontWeight: isToday ? '600' : '400',
                                  position: 'relative',
                                  minHeight: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  opacity: isFuture ? 0.5 : 1,
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected && !isFuture) {
                                    e.target.style.backgroundColor = isCurrentMonth
                                      ? '#f3f4f6'
                                      : '#f9fafb';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected && !isFuture) {
                                    e.target.style.backgroundColor = isToday
                                      ? '#eff6ff'
                                      : dayData.hasContacts
                                      ? '#f0fdf4'
                                      : 'transparent';
                                  }
                                }}
                              >
                                {dayData.date.getDate()}
                                {!isSelected && !isFuture && isCurrentMonth && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      bottom: '2px',
                                      width: '4px',
                                      height: '4px',
                                      backgroundColor: dayData.hasContacts
                                        ? '#10b981' // green dot when data present
                                        : '#ef4444', // red dot when no data
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
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingTop: '8px',
                            borderTop: '1px solid #e5e7eb',
                            marginTop: '4px',
                          }}
                        >
                          <button
                            onClick={() => {
                              const today = new Date();
                              handleCustomDateChange(today);
                            }}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '500',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              backgroundColor: '#f9fafb',
                              color: '#374151',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#f3f4f6';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#f9fafb';
                            }}
                          >
                            Today (IST)
                          </button>
                          <button
                            onClick={clearDateFilter}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '500',
                              borderRadius: '6px',
                              border: '1px solid #dc2626',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#b91c1c';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#dc2626';
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Store
                </label>
                <select
                  value={filters.store}
                  onChange={(e) =>
                    setFilters({ ...filters, store: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Stores</option>
                  {availableStores.map((store) => (
                    <option key={store} value={store}>
                      {store}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Product
                </label>
                <select
                  value={filters.product_name}
                  onChange={(e) =>
                    setFilters({ ...filters, product_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Products</option>
                  {availableProducts.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Contacts Summary */}
            {selectedContacts.size > 0 && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-semibold text-blue-900">
                      {selectedContacts.size} Contact(s) Selected Across Multiple Products
                    </h4>
                  </div>
                  <button
                    onClick={() => setSelectedContacts(new Set())}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {(() => {
                    // Group selected contacts by product
                    const selectedContactsList = allContacts.filter(c => selectedContacts.has(c.id));
                    const groupedByProduct = selectedContactsList.reduce((acc, contact) => {
                      const product = contact.product_name || 'No Product';
                      if (!acc[product]) acc[product] = [];
                      acc[product].push(contact);
                      return acc;
                    }, {});
                    
                    return Object.entries(groupedByProduct).map(([product, contacts]) => (
                      <div key={product} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-blue-800">{product}:</span>
                        <span className="text-blue-600">{contacts.length} contact(s)</span>
                      </div>
                    ));
                  })()}
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  💡 Tip: You can select contacts from different products and assign them all at once!
                </p>
              </div>
            )}

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-md">
              {isLoadingContacts ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No contacts found matching the filters
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedContacts.size === contacts.length && contacts.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Select All ({selectedContacts.size} selected)
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {contacts.length} contact(s) found
                    </span>
                  </div>
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`flex items-center gap-3 p-3 border rounded-md hover:bg-gray-50 ${
                          selectedContacts.has(contact.id)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.id)}
                          onChange={() => handleToggleContact(contact.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {contact.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {contact.phone}
                              </div>
                            </div>
                            {contact.store && (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Building2 className="w-4 h-4" />
                                {contact.store}
                              </div>
                            )}
                            {contact.product_name && (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Package className="w-4 h-4" />
                                {contact.product_name}
                              </div>
                            )}
                            <div
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                contact.assigned_to
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {contact.assigned_to ? "Assigned" : "Unassigned"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 mt-4">
              <button
                onClick={() => {
                  setShowAssignmentModal(false);
                  setSelectedAgent(null);
                  setSelectedContacts(new Set());
                  setFilters({ store: "", product_name: "", date: "" });
                  setShowDatePicker(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isAssigning}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignContacts}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isAssigning || selectedContacts.size === 0}
              >
                {isAssigning
                  ? "Assigning..."
                  : `Assign ${selectedContacts.size} Contact(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Assignments Modal */}
      {showAssignmentsView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  View Assigned Contacts
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  View all contacts assigned to agents
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignmentsView(false);
                  setAssignments([]);
                  setUnassignedContacts([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingAssignments ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Unassigned Contacts */}
                {unassignedCount > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-md font-semibold text-gray-900">
                        Unassigned Contacts ({unassignedCount})
                      </h4>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600">
                        {unassignedCount} contact(s) are not assigned to any agent
                      </div>
                      {unassignedContacts.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {unassignedContacts.slice(0, 10).map((contact) => (
                            <div
                              key={contact.id}
                              className="flex items-center justify-between text-sm bg-white p-2 rounded border border-gray-200"
                            >
                              <div>
                                <span className="font-medium">{contact.name}</span>
                                <span className="text-gray-500 ml-2">
                                  {contact.store} - {contact.product_name}
                                </span>
                              </div>
                              <span className="text-gray-400 text-xs">
                                {contact.status}
                              </span>
                            </div>
                          ))}
                          {unassignedCount > 10 && (
                            <div className="text-xs text-gray-500 text-center pt-2">
                              ... and {unassignedCount - 10} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Assigned Contacts by Agent */}
                <div className="space-y-4">
                  {assignments.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No contacts assigned to any agent yet
                    </div>
                  ) : (
                    assignments.map((assignment) => (
                      <div
                        key={assignment.agent.id}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-600">
                                  {assignment.agent.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-md font-semibold text-gray-900">
                                  {assignment.agent.username}
                                </h4>
                                <p className="text-xs text-gray-500">
                                  {assignment.agent.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-medium text-gray-700">
                                {assignment.count} contact(s) assigned
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedAgent(assignment.agent);
                                  setShowAssignmentModal(true);
                                  setShowAssignmentsView(false);
                                }}
                                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Manage
                              </button>
                            </div>
                          </div>
                        </div>
                        {assignment.contacts.length > 0 && (
                          <div className="bg-white max-h-64 overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Name
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Store
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Product
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {assignment.contacts.slice(0, 20).map((contact) => (
                                  <tr key={contact.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {contact.name}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-600">
                                      {contact.store || "N/A"}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-600">
                                      {contact.product_name || "N/A"}
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                      <span
                                        className={`px-2 py-1 text-xs rounded-full ${
                                          contact.status === "Completed"
                                            ? "bg-green-100 text-green-800"
                                            : contact.status === "Failed"
                                            ? "bg-red-100 text-red-800"
                                            : contact.status === "In Progress"
                                            ? "bg-blue-100 text-blue-800"
                                            : "bg-gray-100 text-gray-800"
                                        }`}
                                      >
                                        {contact.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {assignment.contacts.length > 20 && (
                              <div className="px-4 py-2 text-xs text-gray-500 text-center bg-gray-50">
                                ... and {assignment.contacts.length - 20} more contacts
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t border-gray-200 mt-4">
              <button
                onClick={() => {
                  setShowAssignmentsView(false);
                  setAssignments([]);
                  setUnassignedContacts([]);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
