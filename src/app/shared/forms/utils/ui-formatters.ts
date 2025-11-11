// Pure UI formatting functions - no dependencies, pure input/output
// These functions handle UI-specific formatting and should be used in components

// Credit card formatting functions
export const maskCardNumber = (cardNumber: string): string => {
  if (!cardNumber || cardNumber.length < 4) return cardNumber;
  const last4 = cardNumber.slice(-4);
  return '**** **** **** ' + last4;
};

export const formatCardNumber = (cardNumber: string): string => {
  // Remove all non-digit characters
  const cleaned = cardNumber.replace(/\D/g, '');
  
  // Add spaces every 4 digits
  const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  
  return formatted.trim();
};

export const formatExpiration = (expiration: string): string => {
  // Remove all non-digit characters
  const cleaned = expiration.replace(/\D/g, '');
  
  // Add slash after 2 digits
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
  }
  
  return cleaned;
};

export const formatPhone = (phone: string): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
};

export const formatZipCode = (zip: string): string => {
  // Remove all non-digit characters
  const cleaned = zip.replace(/\D/g, '');
  
  // Format as XXXXX or XXXXX-XXXX
  if (cleaned.length <= 5) {
    return cleaned;
  } else if (cleaned.length <= 9) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
  
  return zip;
};

// Input sanitization for display
export const sanitizeForDisplay = (text: string): string => {
  if (!text) return '';
  
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

// Truncate text with ellipsis
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

// Capitalize first letter of each word
export const capitalizeWords = (text: string): string => {
  if (!text) return '';
  return text.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
};

// Format address for display
export const formatAddress = (address: {
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  zip: string;
}): string => {
  const parts = [
    sanitizeForDisplay(address.address_1),
    address.address_2 ? sanitizeForDisplay(address.address_2) : null,
    `${sanitizeForDisplay(address.city)}, ${sanitizeForDisplay(address.state)} ${sanitizeForDisplay(address.zip)}`
  ].filter(Boolean);
  
  return parts.join(', ');
};

// Format name for display
export const formatName = (firstName: string, lastName: string): string => {
  return `${sanitizeForDisplay(firstName)} ${sanitizeForDisplay(lastName)}`.trim();
};

// Card type detection
export const detectCardType = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\D/g, '');
  
  // Visa
  if (/^4/.test(cleaned)) return 'visa';
  
  // Mastercard
  if (/^5[1-5]/.test(cleaned)) return 'mastercard';
  
  // American Express
  if (/^3[47]/.test(cleaned)) return 'amex';
  
  // Discover
  if (/^6(?:011|5)/.test(cleaned)) return 'discover';
  
  return 'unknown';
};

// Get card display name
export const getCardDisplayName = (cardType: string): string => {
  const names: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    unknown: 'Card'
  };
  
  return names[cardType] || names['unknown'];
};