/**
 * Enterprise Error Handling
 * Structured error hierarchy with proper error classification
 */

export class ApplicationError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

export class ValidationError extends ApplicationError {
    constructor(field, value, constraint, message = null) {
        const msg = message || `Validation failed for field '${field}': ${constraint}`;
        super(msg, 'VALIDATION_ERROR', { field, value, constraint });
    }
}

export class NetworkError extends ApplicationError {
    constructor(message, chainId = null, expectedChainId = null) {
        super(message, 'NETWORK_ERROR', { chainId, expectedChainId });
    }
}

export class ContractError extends ApplicationError {
    constructor(message, contractAddress = null, methodName = null, txHash = null) {
        super(message, 'CONTRACT_ERROR', { contractAddress, methodName, txHash });
    }
}

export class WalletError extends ApplicationError {
    constructor(message, walletType = null) {
        super(message, 'WALLET_ERROR', { walletType });
    }
}

export class APIError extends ApplicationError {
    constructor(message, endpoint = null, statusCode = null, response = null) {
        super(message, 'API_ERROR', { endpoint, statusCode, response });
    }
}

export class BusinessLogicError extends ApplicationError {
    constructor(message, operation = null, context = {}) {
        super(message, 'BUSINESS_LOGIC_ERROR', { operation, ...context });
    }
}

/**
 * Error Handler Service
 */
export class ErrorHandler {
    static #handlers = new Map();

    static register(errorType, handler) {
        this.#handlers.set(errorType, handler);
    }

    static handle(error, context = {}) {
        const handler = this.#handlers.get(error.constructor) || this.#defaultHandler;
        return handler(error, context);
    }

    static #defaultHandler(error, context) {
        console.error('Unhandled error:', error);

        // User-friendly error messages
        const userMessage = ErrorHandler.#getUserFriendlyMessage(error);

        // Show user notification
        if (typeof window !== 'undefined' && window.showNotification) {
            window.showNotification(userMessage, 'error');
        } else {
            alert(`Error: ${userMessage}`);
        }

        return {
            handled: true,
            userMessage,
            shouldRetry: ErrorHandler.#shouldRetry(error)
        };
    }

    static #getUserFriendlyMessage(error) {
        const messageMap = {
            'ValidationError': 'Please check your input and try again.',
            'NetworkError': 'Network connection issue. Please check your wallet connection.',
            'ContractError': 'Smart contract error. Please try again or contact support.',
            'WalletError': 'Wallet connection issue. Please reconnect your wallet.',
            'APIError': 'Service temporarily unavailable. Please try again later.',
            'BusinessLogicError': 'Operation failed. Please check your input and try again.'
        };

        return messageMap[error.name] || 'An unexpected error occurred. Please try again.';
    }

    static #shouldRetry(error) {
        const retryableErrors = ['NetworkError', 'APIError'];
        return retryableErrors.includes(error.name);
    }
}

// Register default handlers
ErrorHandler.register(ValidationError, (error, context) => {
    const field = error.details.field;
    const element = document.querySelector(`[name="${field}"], #${field}`);

    if (element) {
        element.classList.add('error');
        // Remove error class after a delay
        setTimeout(() => element.classList.remove('error'), 3000);
    }

    return ErrorHandler.handle(error, context);
});

ErrorHandler.register(NetworkError, (error, context) => {
    // Attempt to switch network if applicable
    if (error.details.expectedChainId && window.ethereum) {
        // Network switching logic could go here
    }

    return ErrorHandler.handle(error, context);
});