// Security utilities and configuration

// Content Security Policy configuration
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com"],
  'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  'font-src': ["'self'", "https://fonts.gstatic.com"],
  'img-src': ["'self'", "data:", "https:", "https://image.tmdb.org", "https://www.themoviedb.org"],
  'connect-src': ["'self'", "https://*.supabase.co", "https://api.themoviedb.org"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"]
};

export function generateCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

// Rate limiting configurations
export const RATE_LIMITS = {
  SEARCH: { maxRequests: 30, windowMs: 60000 }, // 30 requests per minute
  AUTH: { maxRequests: 5, windowMs: 300000 }, // 5 attempts per 5 minutes
  DRAFT_JOIN: { maxRequests: 10, windowMs: 60000 }, // 10 joins per minute
  EMAIL_SEND: { maxRequests: 3, windowMs: 300000 }, // 3 emails per 5 minutes
} as const;

// Security headers for production
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
} as const;

// Password strength validation
export function validatePasswordStrength(password: string): {
  isStrong: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  // Length check
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');
  
  if (password.length >= 12) score += 1;
  
  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');
  
  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');
  
  if (/[@$!%*?&]/.test(password)) score += 1;
  else feedback.push('Include special characters (@$!%*?&)');
  
  // Common patterns to avoid
  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    feedback.push('Avoid repeating characters');
  }
  
  if (/123|abc|password|qwerty/i.test(password)) {
    score -= 2;
    feedback.push('Avoid common patterns');
  }
  
  return {
    isStrong: score >= 4,
    score: Math.max(0, Math.min(6, score)),
    feedback
  };
}

// Data sanitization for logging
export function sanitizeForLogging(data: any): any {
  if (typeof data === 'string') {
    // Remove potential sensitive data patterns
    return data
      .replace(/password[^&\s]*/gi, 'password=***')
      .replace(/api[_-]?key[^&\s]*/gi, 'api_key=***')
      .replace(/token[^&\s]*/gi, 'token=***')
      .replace(/secret[^&\s]*/gi, 'secret=***')
      .replace(/bearer\s+[^\s]*/gi, 'bearer ***');
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      if (lowerKey.includes('password') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('token') || 
          lowerKey.includes('key')) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = sanitizeForLogging(value);
      }
    }
    
    return sanitized;
  }
  
  return data;
}

// Environment-specific security settings
export function getSecurityConfig() {
  const isDevelopment = import.meta.env.DEV;
  
  return {
    enableCSP: !isDevelopment, // Disable CSP in development for easier debugging
    enableSecurityHeaders: !isDevelopment,
    logLevel: isDevelopment ? 'debug' : 'error',
    enableSourceMaps: isDevelopment,
  };
}