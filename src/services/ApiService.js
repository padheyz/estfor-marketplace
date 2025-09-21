/**
 * API Service
 * Handles all external API communications with error handling and caching
 */

import { config } from '../config/index.js';
import { EstforItem } from '../models/index.js';
import { validator } from '../security/InputValidator.js';

export class ApiService {
    static #instance = null;
    #cache = new Map();
    #pendingRequests = new Map();

    constructor() {
        if (ApiService.#instance) {
            return ApiService.#instance;
        }

        ApiService.#instance = this;
    }

    async fetchEstforItems() {
        const cacheKey = 'estfor-items';
        const cachedData = this.#getFromCache(cacheKey);

        if (cachedData) {
            return cachedData;
        }

        // Prevent duplicate requests
        if (this.#pendingRequests.has(cacheKey)) {
            return this.#pendingRequests.get(cacheKey);
        }

        const requestPromise = this.#fetchItemsFromApi();
        this.#pendingRequests.set(cacheKey, requestPromise);

        try {
            const items = await requestPromise;
            this.#setCache(cacheKey, items, 300000); // Cache for 5 minutes
            return items;

        } catch (error) {
            throw new Error(`Failed to fetch Estfor items: ${error.message}`);
        } finally {
            this.#pendingRequests.delete(cacheKey);
        }
    }

    async #fetchItemsFromApi() {
        const apiConfig = config.get('api.estfor');
        const url = `${apiConfig.baseUrl}/items`;

        // Rate limiting
        const rateLimitCheck = validator.checkRateLimit('api-items', 10, 60000);
        if (!rateLimitCheck.allowed) {
            throw new Error(`API rate limit exceeded. Try again in ${rateLimitCheck.resetTime} seconds.`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeout);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Validate and transform data
            return this.#processItemsData(data);

        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('API request timed out');
            }

            throw error;
        }
    }

    #processItemsData(data) {
        if (!Array.isArray(data)) {
            throw new Error('Invalid API response format');
        }

        const items = [];

        for (const itemData of data) {
            try {
                // Validate each item
                if (!itemData.id || !itemData.name) {
                    continue; // Skip invalid items
                }

                // Sanitize and validate image URL
                let imageUrl = '';
                if (itemData.image) {
                    const urlValidation = validator.validateUrl(itemData.image);
                    imageUrl = urlValidation.isValid ? urlValidation.sanitizedUrl : '';
                }

                const item = new EstforItem({
                    id: itemData.id,
                    name: itemData.name,
                    description: itemData.description || '',
                    image: imageUrl,
                    tier: itemData.tier || 0,
                    skill: itemData.skill || '',
                    isActive: itemData.isActive !== false,
                    metadata: itemData.metadata || {}
                });

                items.push(item);

            } catch (error) {
                console.warn(`Failed to process item ${itemData.id}:`, error);
                // Continue processing other items
            }
        }

        return items;
    }

    async fetchMarketOrders() {
        const cacheKey = 'market-orders';
        const cachedData = this.#getFromCache(cacheKey);

        if (cachedData) {
            return cachedData;
        }

        try {
            const apiConfig = config.get('api.estfor');
            const url = `${apiConfig.baseUrl}/orders`;

            // Rate limiting
            const rateLimitCheck = validator.checkRateLimit('api-orders', 10, 60000);
            if (!rateLimitCheck.allowed) {
                throw new Error(`API rate limit exceeded. Try again in ${rateLimitCheck.resetTime} seconds.`);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeout);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // If orders API fails, return empty array (non-critical)
                console.warn('Market orders API failed:', response.status);
                return [];
            }

            const data = await response.json();
            const orders = this.#processOrdersData(data);

            this.#setCache(cacheKey, orders, 30000); // Cache for 30 seconds
            return orders;

        } catch (error) {
            console.warn('Failed to fetch market orders:', error);
            return []; // Return empty array on failure
        }
    }

    #processOrdersData(data) {
        if (!Array.isArray(data)) {
            return [];
        }

        const orders = [];

        for (const orderData of data) {
            try {
                const order = new MarketOrder({
                    tokenId: orderData.tokenId,
                    side: orderData.side,
                    price: orderData.price,
                    quantity: orderData.quantity,
                    user: orderData.user,
                    timestamp: orderData.timestamp || Date.now()
                });

                orders.push(order);

            } catch (error) {
                console.warn(`Failed to process order:`, error);
            }
        }

        return orders;
    }

    async fetchPlayerItems(playerAddress) {
        // Validate player address
        const addressValidation = validator.validateInput(playerAddress, 'address');
        if (!addressValidation.isValid) {
            throw new Error(`Invalid player address: ${addressValidation.errors.join(', ')}`);
        }

        const cacheKey = `player-items-${addressValidation.sanitizedValue}`;
        const cachedData = this.#getFromCache(cacheKey);

        if (cachedData) {
            return cachedData;
        }

        try {
            const apiConfig = config.get('api.estfor');
            const url = `${apiConfig.baseUrl}/players/${addressValidation.sanitizedValue}/items`;

            // Rate limiting per player
            const rateLimitCheck = validator.checkRateLimit(`player-${addressValidation.sanitizedValue}`, 5, 60000);
            if (!rateLimitCheck.allowed) {
                throw new Error(`Rate limit exceeded for player data. Try again in ${rateLimitCheck.resetTime} seconds.`);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeout);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 404) {
                    return []; // Player not found, return empty
                }
                throw new Error(`Player API request failed: ${response.status}`);
            }

            const data = await response.json();
            const playerItems = this.#processPlayerItemsData(data);

            this.#setCache(cacheKey, playerItems, 60000); // Cache for 1 minute
            return playerItems;

        } catch (error) {
            console.warn('Failed to fetch player items:', error);
            return [];
        }
    }

    #processPlayerItemsData(data) {
        if (!Array.isArray(data)) {
            return [];
        }

        const items = [];

        for (const itemData of data) {
            try {
                const item = new (require('../models/index.js')).UserBalance({
                    tokenId: itemData.tokenId,
                    balance: itemData.balance || 0,
                    lastUpdated: Date.now()
                });

                items.push(item);

            } catch (error) {
                console.warn(`Failed to process player item:`, error);
            }
        }

        return items;
    }

    // Cache management
    #getFromCache(key) {
        const cached = this.#cache.get(key);

        if (!cached) {
            return null;
        }

        if (Date.now() > cached.expiry) {
            this.#cache.delete(key);
            return null;
        }

        return cached.data;
    }

    #setCache(key, data, ttlMs) {
        this.#cache.set(key, {
            data,
            expiry: Date.now() + ttlMs
        });
    }

    clearCache() {
        this.#cache.clear();
    }

    // Health check
    async healthCheck() {
        try {
            const apiConfig = config.get('api.estfor');
            const url = `${apiConfig.baseUrl}/health`;

            const response = await fetch(url, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });

            return {
                isHealthy: response.ok,
                status: response.status,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                isHealthy: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    static getInstance() {
        if (!ApiService.#instance) {
            new ApiService();
        }
        return ApiService.#instance;
    }
}

export const apiService = ApiService.getInstance();