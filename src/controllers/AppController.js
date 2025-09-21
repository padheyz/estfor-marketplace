/**
 * Application Controller
 * Main orchestrator for the application with proper state management
 */

import { config } from '../config/index.js';
import { walletService } from '../services/WalletService.js';
import { marketplaceService } from '../services/MarketplaceService.js';
import { apiService } from '../services/ApiService.js';
import { AppState } from '../models/index.js';
import { validator } from '../security/InputValidator.js';

export class AppController {
    static #instance = null;
    #state = null;
    #eventListeners = new Set();

    constructor() {
        if (AppController.#instance) {
            return AppController.#instance;
        }

        this.#initializeState();
        this.#setupEventListeners();
        AppController.#instance = this;
    }

    #initializeState() {
        this.#state = new AppState({
            isLoading: false,
            error: null,
            items: [],
            orders: [],
            balances: new Map(),
            wallet: null,
            lastUpdated: Date.now()
        });
    }

    #setupEventListeners() {
        // Wallet events
        walletService.addEventListener('connected', (connection) => {
            this.#updateState({ wallet: connection });
            this.#loadInitialData();
        });

        walletService.addEventListener('disconnected', (connection) => {
            this.#updateState({
                wallet: connection,
                balances: new Map()
            });
        });

        walletService.addEventListener('networkChanged', (connection) => {
            this.#updateState({ wallet: connection });
        });

        walletService.addEventListener('error', (error) => {
            this.#updateState({ error: error.message });
        });
    }

    async initialize() {
        try {
            this.#updateState({ isLoading: true, error: null });

            // Check for existing wallet connection
            if (walletService.isConnected) {
                await this.#loadInitialData();
            } else {
                // Load items even without wallet connection
                await this.loadItems();
            }

            this.#updateState({ isLoading: false });

        } catch (error) {
            this.#updateState({
                isLoading: false,
                error: error.message
            });
        }
    }

    async connectWallet() {
        try {
            this.#updateState({ isLoading: true, error: null });

            const connection = await walletService.connect();
            this.#updateState({ wallet: connection });

            // Load data after connection
            await this.#loadInitialData();

            this.#updateState({ isLoading: false });
            return connection;

        } catch (error) {
            this.#updateState({
                isLoading: false,
                error: error.message
            });
            throw error;
        }
    }

    async disconnectWallet() {
        try {
            await walletService.disconnect();
            this.#updateState({
                wallet: null,
                balances: new Map()
            });

        } catch (error) {
            this.#updateState({ error: error.message });
            throw error;
        }
    }

    async loadItems() {
        try {
            this.#updateState({ isLoading: true, error: null });

            const items = await apiService.fetchEstforItems();
            this.#updateState({
                items,
                lastUpdated: Date.now(),
                isLoading: false
            });

            return items;

        } catch (error) {
            this.#updateState({
                isLoading: false,
                error: `Failed to load items: ${error.message}`
            });
            throw error;
        }
    }

    async loadMarketOrders() {
        try {
            const orders = await apiService.fetchMarketOrders();
            this.#updateState({
                orders,
                lastUpdated: Date.now()
            });

            return orders;

        } catch (error) {
            console.warn('Failed to load market orders:', error);
            // Non-critical error, don't update state with error
            return [];
        }
    }

    async loadPlayerItems() {
        if (!walletService.isConnected) {
            throw new Error('Wallet not connected');
        }

        try {
            this.#updateState({ isLoading: true, error: null });

            // Use blockchain to get accurate balances
            const balances = new Map();

            for (const item of this.#state.items) {
                try {
                    const balance = await this.#getTokenBalance(item.id);
                    if (balance > 0) {
                        balances.set(item.id, balance);
                    }
                } catch (error) {
                    console.warn(`Failed to get balance for token ${item.id}:`, error);
                }
            }

            this.#updateState({
                balances,
                lastUpdated: Date.now(),
                isLoading: false
            });

            return balances;

        } catch (error) {
            this.#updateState({
                isLoading: false,
                error: `Failed to load player items: ${error.message}`
            });
            throw error;
        }
    }

    async #getTokenBalance(tokenId) {
        // This would use the items contract to get balance
        // Simplified for now - in real implementation would use ethers
        return 0; // Placeholder
    }

    async createSellOrders(orderRequests) {
        if (!walletService.isConnected) {
            throw new Error('Wallet not connected');
        }

        try {
            this.#updateState({ isLoading: true, error: null });

            // Validate all orders first
            const validatedRequests = this.#validateOrderRequests(orderRequests);

            if (validatedRequests.length === 0) {
                throw new Error('No valid orders to create');
            }

            // Create batch order
            const result = await marketplaceService.createBatchOrders(validatedRequests);

            this.#updateState({ isLoading: false });

            if (result.isSuccessful) {
                // Refresh balances after successful transaction
                await this.loadPlayerItems();
            }

            return result;

        } catch (error) {
            this.#updateState({
                isLoading: false,
                error: error.message
            });
            throw error;
        }
    }

    #validateOrderRequests(requests) {
        const validatedRequests = [];

        for (const request of requests) {
            try {
                // Validate token ID
                const tokenIdValidation = validator.validateInput(request.tokenId, 'tokenId');
                if (!tokenIdValidation.isValid) {
                    console.warn(`Invalid token ID ${request.tokenId}:`, tokenIdValidation.errors);
                    continue;
                }

                // Validate price
                const priceValidation = validator.validateInput(request.priceInEth, 'price');
                if (!priceValidation.isValid) {
                    console.warn(`Invalid price for token ${request.tokenId}:`, priceValidation.errors);
                    continue;
                }

                // Validate quantity
                const quantityValidation = validator.validateInput(request.amount, 'quantity');
                if (!quantityValidation.isValid) {
                    console.warn(`Invalid quantity for token ${request.tokenId}:`, quantityValidation.errors);
                    continue;
                }

                // Check balance
                const balance = this.#state.balances.get(tokenIdValidation.sanitizedValue) || 0;
                if (balance < quantityValidation.sanitizedValue) {
                    console.warn(`Insufficient balance for token ${request.tokenId}`);
                    continue;
                }

                validatedRequests.push({
                    tokenId: tokenIdValidation.sanitizedValue,
                    priceInEth: priceValidation.sanitizedValue,
                    amount: quantityValidation.sanitizedValue,
                    side: 'sell'
                });

            } catch (error) {
                console.warn(`Failed to validate order for token ${request.tokenId}:`, error);
            }
        }

        return validatedRequests;
    }

    async #loadInitialData() {
        try {
            // Load items first
            await this.loadItems();

            // Load market orders (non-blocking)
            this.loadMarketOrders().catch(console.warn);

            // Load player items if wallet is connected
            if (walletService.isConnected) {
                await this.loadPlayerItems();
            }

        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    #updateState(updates) {
        const newState = new AppState({
            ...this.#state,
            ...updates
        });

        this.#state = newState;
        this.#notifyStateChange(newState);
    }

    #notifyStateChange(newState) {
        this.#eventListeners.forEach(listener => {
            try {
                listener(newState);
            } catch (error) {
                console.error('State change listener error:', error);
            }
        });
    }

    // Public getters
    get state() {
        return this.#state;
    }

    get isConnected() {
        return walletService.isConnected;
    }

    get items() {
        return this.#state.items;
    }

    get balances() {
        return this.#state.balances;
    }

    get isLoading() {
        return this.#state.isLoading;
    }

    get error() {
        return this.#state.error;
    }

    // Event system
    addStateListener(callback) {
        this.#eventListeners.add(callback);
    }

    removeStateListener(callback) {
        this.#eventListeners.delete(callback);
    }

    // Utility methods
    getItemById(tokenId) {
        return this.#state.getItemById(tokenId);
    }

    getBalanceForToken(tokenId) {
        return this.#state.getBalanceForToken(tokenId);
    }

    clearError() {
        this.#updateState({ error: null });
    }

    static getInstance() {
        if (!AppController.#instance) {
            new AppController();
        }
        return AppController.#instance;
    }
}

export const appController = AppController.getInstance();