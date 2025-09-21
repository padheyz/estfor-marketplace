/**
 * Security and Input Validation Layer
 * Comprehensive input sanitization and validation
 */

import { config } from '../config/index.js';

export class InputValidator {
    static #instance = null;

    constructor() {
        if (InputValidator.#instance) {
            return InputValidator.#instance;
        }
        InputValidator.#instance = this;
    }

    /**
     * Sanitize HTML input to prevent XSS
     */
    sanitizeHtml(input) {
        if (typeof input !== 'string') return input;

        // Remove script tags and event handlers
        const cleaned = input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/data:/gi, '')
            .replace(/vbscript:/gi, '');

        return this.#escapeHtml(cleaned);
    }

    #escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Validate and sanitize user inputs
     */
    validateInput(value, type, options = {}) {
        const result = {
            isValid: false,
            sanitizedValue: null,
            errors: []
        };

        // Basic sanitization
        if (typeof value === 'string') {
            value = value.trim();

            // Check length limits
            const maxLength = options.maxLength || config.get('app.security.maxInputLength');
            if (value.length > maxLength) {
                result.errors.push(`Input too long. Maximum ${maxLength} characters allowed.`);
                return result;
            }

            // Sanitize HTML if needed
            if (options.sanitizeHtml !== false) {
                value = this.sanitizeHtml(value);
            }
        }

        // Type-specific validation
        switch (type) {
            case 'price':
                return this.#validatePrice(value);
            case 'quantity':
                return this.#validateQuantity(value);
            case 'tokenId':
                return this.#validateTokenId(value);
            case 'address':
                return this.#validateAddress(value);
            case 'text':
                return this.#validateText(value, options);
            default:
                result.errors.push(`Unknown validation type: ${type}`);
                return result;
        }
    }

    #validatePrice(value) {
        const result = { isValid: false, sanitizedValue: null, errors: [] };
        const rules = config.get('validation.price');

        // Convert to number
        const numValue = parseFloat(value);

        if (isNaN(numValue)) {
            result.errors.push('Price must be a valid number');
            return result;
        }

        if (numValue < rules.min) {
            result.errors.push(`Price must be at least ${rules.min} ETH`);
            return result;
        }

        if (numValue > rules.max) {
            result.errors.push(`Price cannot exceed ${rules.max} ETH`);
            return result;
        }

        if (numValue <= 0) {
            result.errors.push('Price must be greater than 0');
            return result;
        }

        result.isValid = true;
        result.sanitizedValue = numValue;
        return result;
    }

    #validateQuantity(value) {
        const result = { isValid: false, sanitizedValue: null, errors: [] };
        const rules = config.get('validation.quantity');

        // Convert to integer
        const intValue = parseInt(value, 10);

        if (isNaN(intValue)) {
            result.errors.push('Quantity must be a valid number');
            return result;
        }

        if (intValue < rules.min) {
            result.errors.push(`Quantity must be at least ${rules.min}`);
            return result;
        }

        if (intValue > rules.max) {
            result.errors.push(`Quantity cannot exceed ${rules.max}`);
            return result;
        }

        if (!Number.isInteger(intValue) || intValue !== parseFloat(value)) {
            result.errors.push('Quantity must be a whole number');
            return result;
        }

        result.isValid = true;
        result.sanitizedValue = intValue;
        return result;
    }

    #validateTokenId(value) {
        const result = { isValid: false, sanitizedValue: null, errors: [] };
        const rules = config.get('validation.tokenId');

        const intValue = parseInt(value, 10);

        if (isNaN(intValue)) {
            result.errors.push('Token ID must be a valid number');
            return result;
        }

        if (intValue < rules.min) {
            result.errors.push(`Token ID must be at least ${rules.min}`);
            return result;
        }

        if (intValue > rules.max) {
            result.errors.push('Token ID is too large');
            return result;
        }

        result.isValid = true;
        result.sanitizedValue = intValue;
        return result;
    }

    #validateAddress(value) {
        const result = { isValid: false, sanitizedValue: null, errors: [] };

        if (typeof value !== 'string') {
            result.errors.push('Address must be a string');
            return result;
        }

        // Basic Ethereum address format check
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;

        if (!addressRegex.test(value)) {
            result.errors.push('Invalid Ethereum address format');
            return result;
        }

        result.isValid = true;
        result.sanitizedValue = value.toLowerCase();
        return result;
    }

    #validateText(value, options = {}) {
        const result = { isValid: false, sanitizedValue: null, errors: [] };

        if (typeof value !== 'string') {
            result.errors.push('Text must be a string');
            return result;
        }

        // Check minimum length
        if (options.minLength && value.length < options.minLength) {
            result.errors.push(`Text must be at least ${options.minLength} characters`);
            return result;
        }

        // Check for dangerous patterns
        const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /data:\s*text\/html/i,
            /vbscript:/i
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(value)) {
                result.errors.push('Text contains potentially dangerous content');
                return result;
            }
        }

        result.isValid = true;
        result.sanitizedValue = this.sanitizeHtml(value);
        return result;
    }

    /**
     * Validate URL for security
     */
    validateUrl(url, allowedDomains = []) {
        const result = { isValid: false, sanitizedUrl: null, errors: [] };

        try {
            const urlObj = new URL(url);

            // Only allow HTTPS in production
            if (config.isProduction() && urlObj.protocol !== 'https:') {
                result.errors.push('Only HTTPS URLs are allowed');
                return result;
            }

            // Check allowed domains
            const configDomains = config.get('app.security.allowedImageDomains') || [];
            const allAllowedDomains = [...configDomains, ...allowedDomains];

            if (allAllowedDomains.length > 0) {
                const isAllowed = allAllowedDomains.some(domain =>
                    urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
                );

                if (!isAllowed) {
                    result.errors.push('URL domain not allowed');
                    return result;
                }
            }

            result.isValid = true;
            result.sanitizedUrl = urlObj.toString();
            return result;

        } catch (error) {
            result.errors.push('Invalid URL format');
            return result;
        }
    }

    /**
     * Rate limiting for API calls
     */
    static #rateLimits = new Map();

    checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
        const now = Date.now();
        const windowStart = now - windowMs;

        if (!InputValidator.#rateLimits.has(key)) {
            InputValidator.#rateLimits.set(key, []);
        }

        const requests = InputValidator.#rateLimits.get(key);

        // Remove old requests
        const recentRequests = requests.filter(timestamp => timestamp > windowStart);
        InputValidator.#rateLimits.set(key, recentRequests);

        if (recentRequests.length >= maxRequests) {
            return {
                allowed: false,
                resetTime: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
            };
        }

        // Add current request
        recentRequests.push(now);
        return { allowed: true };
    }

    static getInstance() {
        if (!InputValidator.#instance) {
            new InputValidator();
        }
        return InputValidator.#instance;
    }
}

export const validator = InputValidator.getInstance();