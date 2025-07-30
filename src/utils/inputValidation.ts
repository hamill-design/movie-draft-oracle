// Input validation and sanitization utilities

export const VALIDATION_RULES = {
  INVITE_CODE: {
    length: 8,
    pattern: /^[A-Z0-9]{8}$/,
    message: 'Invite code must be 8 alphanumeric characters'
  },
  PARTICIPANT_NAME: {
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9\s\-_.]+$/,
    message: 'Participant name must be 1-50 characters, alphanumeric with spaces, hyphens, dots, underscores only'
  },
  DRAFT_TITLE: {
    minLength: 1,
    maxLength: 200,
    message: 'Draft title must be 1-200 characters'
  },
  DRAFT_THEME: {
    minLength: 1,
    maxLength: 100,
    message: 'Draft theme must be 1-100 characters'
  },
  DRAFT_OPTION: {
    minLength: 1,
    maxLength: 100,
    message: 'Draft option must be 1-100 characters'
  },
  MOVIE_TITLE: {
    minLength: 1,
    maxLength: 200,
    message: 'Movie title must be 1-200 characters'
  },
  CATEGORY: {
    minLength: 1,
    maxLength: 100,
    message: 'Category must be 1-100 characters'
  },
  EMAIL: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 254,
    message: 'Please enter a valid email address'
  },
  PASSWORD: {
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
  }
};

export function validateInviteCode(code: string): { isValid: boolean; error?: string } {
  if (!code || typeof code !== 'string') {
    return { isValid: false, error: 'Invite code is required' };
  }
  
  const trimmed = code.trim().toUpperCase();
  
  if (trimmed.length !== VALIDATION_RULES.INVITE_CODE.length) {
    return { isValid: false, error: VALIDATION_RULES.INVITE_CODE.message };
  }
  
  if (!VALIDATION_RULES.INVITE_CODE.pattern.test(trimmed)) {
    return { isValid: false, error: VALIDATION_RULES.INVITE_CODE.message };
  }
  
  return { isValid: true };
}

export function validateParticipantName(name: string): { isValid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Participant name is required' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < VALIDATION_RULES.PARTICIPANT_NAME.minLength || 
      trimmed.length > VALIDATION_RULES.PARTICIPANT_NAME.maxLength) {
    return { isValid: false, error: VALIDATION_RULES.PARTICIPANT_NAME.message };
  }
  
  if (!VALIDATION_RULES.PARTICIPANT_NAME.pattern.test(trimmed)) {
    return { isValid: false, error: VALIDATION_RULES.PARTICIPANT_NAME.message };
  }
  
  return { isValid: true };
}

export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }
  
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length > VALIDATION_RULES.EMAIL.maxLength) {
    return { isValid: false, error: VALIDATION_RULES.EMAIL.message };
  }
  
  if (!VALIDATION_RULES.EMAIL.pattern.test(trimmed)) {
    return { isValid: false, error: VALIDATION_RULES.EMAIL.message };
  }
  
  return { isValid: true };
}

export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }
  
  if (password.length < VALIDATION_RULES.PASSWORD.minLength) {
    return { isValid: false, error: VALIDATION_RULES.PASSWORD.message };
  }
  
  if (!VALIDATION_RULES.PASSWORD.pattern.test(password)) {
    return { isValid: false, error: VALIDATION_RULES.PASSWORD.message };
  }
  
  return { isValid: true };
}

export function validateDraftTitle(title: string): { isValid: boolean; error?: string } {
  if (!title || typeof title !== 'string') {
    return { isValid: false, error: 'Draft title is required' };
  }
  
  const trimmed = title.trim();
  
  if (trimmed.length < VALIDATION_RULES.DRAFT_TITLE.minLength || 
      trimmed.length > VALIDATION_RULES.DRAFT_TITLE.maxLength) {
    return { isValid: false, error: VALIDATION_RULES.DRAFT_TITLE.message };
  }
  
  return { isValid: true };
}

export function validateMovieTitle(title: string): { isValid: boolean; error?: string } {
  if (!title || typeof title !== 'string') {
    return { isValid: false, error: 'Movie title is required' };
  }
  
  const trimmed = title.trim();
  
  if (trimmed.length < VALIDATION_RULES.MOVIE_TITLE.minLength || 
      trimmed.length > VALIDATION_RULES.MOVIE_TITLE.maxLength) {
    return { isValid: false, error: VALIDATION_RULES.MOVIE_TITLE.message };
  }
  
  return { isValid: true };
}

// XSS Protection - Sanitize HTML input
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Rate limiting helper
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const requests = new Map<string, number[]>();
  
  return (key: string): boolean => {
    const now = Date.now();
    const userRequests = requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    validRequests.push(now);
    requests.set(key, validRequests);
    
    return true; // Request allowed
  };
}

// Input length limits
export const INPUT_LIMITS = {
  MAX_CATEGORIES: 20,
  MAX_PARTICIPANTS: 50,
  MAX_SEARCH_QUERY_LENGTH: 100,
  MAX_MOVIE_SEARCH_RESULTS: 20
} as const;