/**
 * Masks a phone number by showing only the first 2 and last 2 digits
 * Example: +91 9876543210 -> +91 98******10
 * Example: 9876543210 -> 98******10
 */
export const maskPhone = (phone) => {
  if (!phone || phone === 'N/A') return phone;
  
  // Remove all non-digit characters except + at the start
  const cleaned = phone.toString().trim();
  const hasPlus = cleaned.startsWith('+');
  const digits = cleaned.replace(/\D/g, '');
  
  if (digits.length < 4) {
    // If phone is too short, just mask everything except first and last
    return hasPlus ? `+${'*'.repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}` : `${'*'.repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}`;
  }
  
  // Show first 2 digits, mask the middle, show last 2 digits
  const firstTwo = digits.slice(0, 2);
  const lastTwo = digits.slice(-2);
  const masked = '*'.repeat(Math.max(0, digits.length - 4));
  
  return hasPlus ? `+${firstTwo}${masked}${lastTwo}` : `${firstTwo}${masked}${lastTwo}`;
};

/**
 * Masks a name by showing only the first letter and masking the rest
 * Example: "John Doe" -> "J*** D**"
 * Example: "John" -> "J***"
 */
export const maskName = (name) => {
  if (!name || name === 'Unknown' || name === 'N/A') return name;
  
  const trimmed = name.toString().trim();
  if (trimmed.length === 0) return trimmed;
  
  // Split by spaces to handle multiple words
  const words = trimmed.split(/\s+/);
  
  return words
    .map((word) => {
      if (word.length === 0) return word;
      if (word.length === 1) return word + '*';
      // Show first character, mask the rest
      return word.charAt(0) + '*'.repeat(Math.max(1, word.length - 1));
    })
    .join(' ');
};

