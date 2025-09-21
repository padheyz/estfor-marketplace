/**
 * Domain Models and Data Transfer Objects
 * Clean data structures with validation and transformation
 */

import { validator } from '../security/InputValidator.js';

/**
 * Base Model with common functionality
 */
export class BaseModel {
    constructor(data = {}) {
        this.#validate(data);
        Object.assign(this, this.#transform(data));
        Object.freeze(this); // Immutable objects
    }

    #validate(data) {
        // Override in subclasses
        return true;
    }

    #transform(data) {
        // Override in subclasses
        return data;
    }

    toJSON() {
        return { ...this };
    }

    static fromJSON(json) {
        return new this(json);
    }
}

/**
 * Estfor Item Model
 */
export class EstforItem extends BaseModel {
    constructor(data) {
        super(data);
    }

    #validate(data) {
        if (!data.id) {
            throw new Error('Item ID is required');
        }

        const tokenIdValidation = validator.validateInput(data.id, 'tokenId');
        if (!tokenIdValidation.isValid) {
            throw new Error(`Invalid token ID: ${tokenIdValidation.errors.join(', ')}`);
        }

        if (!data.name || typeof data.name !== 'string') {
            throw new Error('Item name is required and must be a string');
        }

        return true;
    }

    #transform(data) {
        const nameValidation = validator.validateInput(data.name, 'text');

        return {
            id: parseInt(data.id, 10),
            name: nameValidation.sanitizedValue || data.name,
            description: data.description ? validator.sanitizeHtml(data.description) : '',
            image: data.image || '',
            tier: data.tier || 0,
            skill: data.skill || '',
            isActive: Boolean(data.isActive ?? true),
            metadata: data.metadata || {}
        };
    }

    get displayName() {
        return `${this.name} (#${this.id})`;
    }

    get imageUrl() {
        if (!this.image) return '';

        const urlValidation = validator.validateUrl(this.image);
        return urlValidation.isValid ? urlValidation.sanitizedUrl : '';
    }
}

/**
 * Market Order Model
 */
export class MarketOrder extends BaseModel {
    constructor(data) {
        super(data);
    }

    #validate(data) {
        const validations = [
            { field: 'tokenId', type: 'tokenId', value: data.tokenId },
            { field: 'price', type: 'price', value: data.price },
            { field: 'quantity', type: 'quantity', value: data.quantity }
        ];

        for (const { field, type, value } of validations) {
            const validation = validator.validateInput(value, type);
            if (!validation.isValid) {
                throw new Error(`Invalid ${field}: ${validation.errors.join(', ')}`);
            }
        }

        if (!['buy', 'sell'].includes(data.side)) {
            throw new Error('Order side must be either "buy" or "sell"');
        }

        return true;
    }

    #transform(data) {
        const tokenIdValidation = validator.validateInput(data.tokenId, 'tokenId');
        const priceValidation = validator.validateInput(data.price, 'price');
        const quantityValidation = validator.validateInput(data.quantity, 'quantity');

        return {
            tokenId: tokenIdValidation.sanitizedValue,
            side: data.side,
            price: priceValidation.sanitizedValue,
            quantity: quantityValidation.sanitizedValue,
            user: data.user || '',
            timestamp: data.timestamp || Date.now(),
            status: data.status || 'pending',
            txHash: data.txHash || null
        };
    }

    get sideNumeric() {
        return this.side === 'sell' ? 0 : 1;
    }

    get totalValue() {
        return this.price * this.quantity;
    }

    get isExpired() {
        // Orders expire after 30 days
        const expiryTime = this.timestamp + (30 * 24 * 60 * 60 * 1000);
        return Date.now() > expiryTime;
    }
}

/**
 * User Balance Model
 */
export class UserBalance extends BaseModel {
    constructor(data) {
        super(data);
    }

    #validate(data) {
        const tokenIdValidation = validator.validateInput(data.tokenId, 'tokenId');
        if (!tokenIdValidation.isValid) {
            throw new Error(`Invalid token ID: ${tokenIdValidation.errors.join(', ')}`);
        }

        const balanceValidation = validator.validateInput(data.balance, 'quantity');
        if (!balanceValidation.isValid) {
            throw new Error(`Invalid balance: ${balanceValidation.errors.join(', ')}`);
        }

        return true;
    }

    #transform(data) {
        const tokenIdValidation = validator.validateInput(data.tokenId, 'tokenId');
        const balanceValidation = validator.validateInput(data.balance, 'quantity');

        return {
            tokenId: tokenIdValidation.sanitizedValue,
            balance: balanceValidation.sanitizedValue,
            lastUpdated: data.lastUpdated || Date.now()
        };
    }

    get hasBalance() {
        return this.balance > 0;
    }

    canSell(quantity) {
        const quantityValidation = validator.validateInput(quantity, 'quantity');
        if (!quantityValidation.isValid) {
            return { canSell: false, reason: 'Invalid quantity' };
        }

        if (quantityValidation.sanitizedValue > this.balance) {
            return {
                canSell: false,
                reason: `Insufficient balance. Have: ${this.balance}, Need: ${quantityValidation.sanitizedValue}`
            };
        }

        return { canSell: true };
    }
}

/**
 * Transaction Result Model
 */
export class TransactionResult extends BaseModel {
    constructor(data) {
        super(data);
    }

    #validate(data) {
        if (data.success !== true && data.success !== false) {
            throw new Error('Transaction result must have a boolean success field');
        }

        if (data.txHash && typeof data.txHash !== 'string') {
            throw new Error('Transaction hash must be a string');
        }

        return true;
    }

    #transform(data) {
        return {
            success: Boolean(data.success),
            txHash: data.txHash || null,
            blockNumber: data.blockNumber || null,
            gasUsed: data.gasUsed || null,
            error: data.error || null,
            timestamp: data.timestamp || Date.now(),
            ordersCreated: data.ordersCreated || 0,
            note: data.note || null
        };
    }

    get explorerUrl() {
        if (!this.txHash) return null;

        const explorerBase = 'https://sonicscan.org/tx/';
        return `${explorerBase}${this.txHash}`;
    }

    get isSuccessful() {
        return this.success === true;
    }

    get errorMessage() {
        if (this.isSuccessful) return null;
        return this.error || 'Unknown error occurred';
    }
}

/**
 * Wallet Connection Model
 */
export class WalletConnection extends BaseModel {
    constructor(data) {
        super(data);
    }

    #validate(data) {
        if (data.address) {
            const addressValidation = validator.validateInput(data.address, 'address');
            if (!addressValidation.isValid) {
                throw new Error(`Invalid wallet address: ${addressValidation.errors.join(', ')}`);
            }
        }

        return true;
    }

    #transform(data) {
        let sanitizedAddress = null;
        if (data.address) {
            const addressValidation = validator.validateInput(data.address, 'address');
            sanitizedAddress = addressValidation.sanitizedValue;
        }

        return {
            address: sanitizedAddress,
            isConnected: Boolean(data.isConnected),
            chainId: data.chainId || null,
            walletType: data.walletType || 'unknown',
            lastConnected: data.lastConnected || Date.now()
        };
    }

    get shortAddress() {
        if (!this.address) return '';
        return `${this.address.slice(0, 6)}...${this.address.slice(-4)}`;
    }

    get isOnCorrectNetwork() {
        return this.chainId === 146; // Sonic network
    }
}

/**
 * Application State Model
 */
export class AppState extends BaseModel {
    constructor(data) {
        super(data);
    }

    #transform(data) {
        return {
            isLoading: Boolean(data.isLoading),
            error: data.error || null,
            items: Array.isArray(data.items) ? data.items.map(item => new EstforItem(item)) : [],
            orders: Array.isArray(data.orders) ? data.orders.map(order => new MarketOrder(order)) : [],
            balances: new Map(data.balances || []),
            wallet: data.wallet ? new WalletConnection(data.wallet) : null,
            lastUpdated: data.lastUpdated || Date.now()
        };
    }

    get connectedWallet() {
        return this.wallet?.isConnected ? this.wallet : null;
    }

    get hasError() {
        return this.error !== null;
    }

    getItemById(tokenId) {
        return this.items.find(item => item.id === tokenId);
    }

    getBalanceForToken(tokenId) {
        return this.balances.get(tokenId) || new UserBalance({ tokenId, balance: 0 });
    }
}