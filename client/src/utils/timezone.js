// Global timezone utilities for Indian Standard Time (IST)
// This ensures the entire application follows Indian timezone by default

/**
 * Get current date and time in Indian timezone
 * @returns {Date} Current date in IST
 */
export const getIndianDate = () => {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
};

/**
 * Convert any date to Indian timezone
 * @param {Date} date - The date to convert
 * @returns {Date} Date converted to IST
 */
export const toIndianDate = (date) => {
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

/**
 * Format date as YYYY-MM-DD in Indian timezone
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string (YYYY-MM-DD)
 */
export const formatIndianDate = (date) => {
  const indianDate = toIndianDate(date);
  const year = indianDate.getFullYear();
  const month = String(indianDate.getMonth() + 1).padStart(2, "0");
  const day = String(indianDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Format date and time in Indian timezone
 * @param {Date} date - The date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date and time string
 */
export const formatIndianDateTime = (date, options = {}) => {
  const defaultOptions = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    ...options,
  };

  return new Intl.DateTimeFormat("en-IN", defaultOptions).format(date);
};

/**
 * Check if a date is today in Indian timezone
 * @param {Date} date - The date to check
 * @returns {boolean} True if the date is today in IST
 */
export const isTodayInIndia = (date) => {
  const today = getIndianDate();
  const dateIST = toIndianDate(date);
  return dateIST.toDateString() === today.toDateString();
};

/**
 * Get yesterday's date in Indian timezone
 * @returns {Date} Yesterday's date in IST
 */
export const getYesterdayInIndia = () => {
  const yesterday = getIndianDate();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
};

/**
 * Get tomorrow's date in Indian timezone
 * @returns {Date} Tomorrow's date in IST
 */
export const getTomorrowInIndia = () => {
  const tomorrow = getIndianDate();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

/**
 * Get timezone offset for India (in minutes)
 * @returns {number} Timezone offset in minutes (330 for IST)
 */
export const getIndianTimezoneOffset = () => {
  const now = new Date();
  const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const indianTime = new Date(
    utc.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  return (indianTime.getTime() - utc.getTime()) / (1000 * 60);
};

/**
 * Get current time in Indian timezone as string
 * @returns {string} Current time in IST format
 */
export const getCurrentIndianTime = () => {
  return formatIndianDateTime(getIndianDate());
};

/**
 * Get current date in Indian timezone as string (YYYY-MM-DD)
 * @returns {string} Current date in IST format
 */
export const getCurrentIndianDate = () => {
  return formatIndianDate(getIndianDate());
};
