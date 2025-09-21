/**
 * Main Application Entry Point
 * Enterprise-grade initialization and UI binding
 */

import { config } from './config/index.js';
import { appController } from './controllers/AppController.js';
import { validator } from './security/InputValidator.js';

class EstforMarketplaceApp {
    constructor() {
        this.isInitialized = false;
        this.selectedItems = new Set();
        this.uiElements = {};
    }

    async initialize() {
        try {
            console.log('Initializing Estfor Marketplace...');

            // Wait for ethers.js to load
            await this.#waitForEthers();

            // Initialize UI elements
            this.#initializeUIElements();

            // Set up event listeners
            this.#setupEventListeners();

            // Initialize application controller
            await appController.initialize();

            // Set up state listeners
            this.#setupStateListeners();

            // Show debug panel in development
            if (config.isDevelopment()) {
                this.#showDebugPanel();
            }

            this.isInitialized = true;
            console.log('Estfor Marketplace initialized successfully');

        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.#showError('Failed to initialize application. Please refresh the page.');
        }
    }

    async #waitForEthers() {
        // Wait for ethers.js to be available
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max

        while (!window.ethers && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!window.ethers) {
            throw new Error('Ethers.js library failed to load. Please check your internet connection and refresh the page.');
        }

        console.log('Ethers.js loaded successfully');
    }

    #initializeUIElements() {
        const elements = [
            'wallet-btn', 'load-items-btn', 'load-orders-btn', 'load-player-items-btn',
            'create-sell-orders-btn', 'select-all-checkbox', 'network-status',
            'loading-overlay', 'error-banner', 'success-banner', 'items-list',
            'items-count', 'last-updated', 'selected-count', 'debug-panel',
            'debug-output', 'debug-toggle', 'debug-clear'
        ];

        elements.forEach(id => {
            this.uiElements[id] = document.getElementById(id);
            if (!this.uiElements[id]) {
                console.warn(`UI element not found: ${id}`);
            }
        });
    }

    #setupEventListeners() {
        // Wallet connection
        this.uiElements['wallet-btn']?.addEventListener('click', () => {
            this.#handleWalletAction();
        });

        // Data loading
        this.uiElements['load-items-btn']?.addEventListener('click', () => {
            this.#loadItems();
        });

        this.uiElements['load-orders-btn']?.addEventListener('click', () => {
            this.#loadMarketOrders();
        });

        this.uiElements['load-player-items-btn']?.addEventListener('click', () => {
            this.#loadPlayerItems();
        });

        // Order creation
        this.uiElements['create-sell-orders-btn']?.addEventListener('click', () => {
            this.#createSellOrders();
        });

        // Select all functionality
        this.uiElements['select-all-checkbox']?.addEventListener('change', (e) => {
            this.#handleSelectAll(e.target.checked);
        });

        // Error/success banner close buttons
        document.querySelectorAll('.error-close, .success-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.error-banner, .success-banner').classList.add('hidden');
            });
        });

        // Debug panel controls
        this.uiElements['debug-toggle']?.addEventListener('click', () => {
            this.#toggleDebugPanel();
        });

        this.uiElements['debug-clear']?.addEventListener('click', () => {
            this.#clearDebugLog();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.#handleKeyboardShortcuts(e);
        });
    }

    #setupStateListeners() {
        appController.addStateListener((state) => {
            this.#updateUI(state);
        });
    }

    #updateUI(state) {
        // Update loading state
        if (state.isLoading) {
            this.uiElements['loading-overlay']?.classList.remove('hidden');
        } else {
            this.uiElements['loading-overlay']?.classList.add('hidden');
        }

        // Update error state
        if (state.hasError) {
            this.#showError(state.error);
        } else {
            this.#hideError();
        }

        // Update wallet status
        this.#updateWalletStatus(state.wallet);

        // Update items list
        this.#updateItemsList(state.items, state.balances);

        // Update stats
        this.#updateStats(state);

        // Update controls
        this.#updateControls(state);
    }

    #updateWalletStatus(wallet) {
        const statusEl = this.uiElements['network-status'];
        const btnEl = this.uiElements['wallet-btn'];

        if (!statusEl || !btnEl) return;

        if (wallet?.isConnected) {
            statusEl.innerHTML = `
                <span class="status-indicator connected"></span>
                <span class="status-text">Connected: ${wallet.shortAddress}</span>
            `;
            btnEl.textContent = 'Disconnect';
            btnEl.classList.remove('btn-primary');
            btnEl.classList.add('btn-secondary');
        } else {
            statusEl.innerHTML = `
                <span class="status-indicator"></span>
                <span class="status-text">Disconnected</span>
            `;
            btnEl.textContent = 'Connect Wallet';
            btnEl.classList.remove('btn-secondary');
            btnEl.classList.add('btn-primary');
        }
    }

    #updateItemsList(items, balances) {
        const listEl = this.uiElements['items-list'];
        if (!listEl) return;

        if (!items || items.length === 0) {
            listEl.innerHTML = '<div class="no-items"><p>No items loaded. Click "Load Items" to get started.</p></div>';
            return;
        }

        const itemsHtml = items.map(item => {
            const balance = balances.get(item.id) || 0;
            const isSelected = this.selectedItems.has(item.id);

            return `
                <div class="item-row ${isSelected ? 'selected' : ''}" data-token-id="${item.id}">
                    <div class="item-select">
                        <input type="checkbox"
                               class="item-checkbox"
                               data-token-id="${item.id}"
                               ${isSelected ? 'checked' : ''}>
                    </div>
                    <div class="item-id">#${item.id}</div>
                    <div class="item-info">
                        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" class="item-image">` : '<div class="item-image"></div>'}
                        <div class="item-details">
                            <div class="item-name" title="${item.name}">${item.name}</div>
                            <div class="item-tier">Tier ${item.tier}</div>
                        </div>
                    </div>
                    <div class="balance-display ${balance === 0 ? 'zero' : ''}">${balance}</div>
                    <div class="market-price">-</div>
                    <div class="quantity-input">
                        <input type="number"
                               class="input-field qty-to-sell-input"
                               placeholder="0"
                               min="1"
                               max="${balance}"
                               value="${balance > 0 ? balance : ''}"
                               ${balance === 0 ? 'disabled' : ''}>
                    </div>
                    <div class="price-input">
                        <input type="number"
                               class="input-field sell-price-input"
                               placeholder="0.00"
                               step="0.001"
                               min="0.000001"
                               ${balance === 0 ? 'disabled' : ''}>
                    </div>
                    <div class="total-value">-</div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = itemsHtml;

        // Re-attach event listeners
        this.#attachItemEventListeners();
    }

    #attachItemEventListeners() {
        // Item selection
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const tokenId = parseInt(e.target.dataset.tokenId);
                const row = e.target.closest('.item-row');

                if (e.target.checked) {
                    this.selectedItems.add(tokenId);
                    row.classList.add('selected');
                } else {
                    this.selectedItems.delete(tokenId);
                    row.classList.remove('selected');
                }

                this.#updateSelectedCount();
                this.#updateCreateOrdersButton();
            });
        });

        // Input validation and calculations
        document.querySelectorAll('.qty-to-sell-input, .sell-price-input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.#validateInput(e.target);
                this.#updateTotalValue(e.target.closest('.item-row'));
            });

            input.addEventListener('blur', (e) => {
                this.#validateInput(e.target);
            });
        });
    }

    #validateInput(input) {
        const value = input.value;
        const type = input.classList.contains('qty-to-sell-input') ? 'quantity' : 'price';

        input.classList.remove('error');

        if (value === '') return;

        const validation = validator.validateInput(value, type);
        if (!validation.isValid) {
            input.classList.add('error');
            input.title = validation.errors.join(', ');
        } else {
            input.title = '';
        }
    }

    #updateTotalValue(row) {
        const qtyInput = row.querySelector('.qty-to-sell-input');
        const priceInput = row.querySelector('.sell-price-input');
        const totalEl = row.querySelector('.total-value');

        const qty = parseFloat(qtyInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;
        const total = qty * price;

        if (total > 0) {
            totalEl.textContent = `${total.toFixed(4)} ETH`;
            totalEl.classList.add('total-value');
        } else {
            totalEl.textContent = '-';
            totalEl.classList.remove('total-value');
        }
    }

    #updateSelectedCount() {
        const countEl = this.uiElements['selected-count'];
        if (countEl) {
            const count = this.selectedItems.size;
            countEl.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
        }
    }

    #updateCreateOrdersButton() {
        const btnEl = this.uiElements['create-sell-orders-btn'];
        if (btnEl) {
            btnEl.disabled = this.selectedItems.size === 0 || !appController.isConnected;
        }
    }

    #updateStats(state) {
        if (this.uiElements['items-count']) {
            this.uiElements['items-count'].textContent = `${state.items.length} items`;
        }

        if (this.uiElements['last-updated'] && state.lastUpdated) {
            const date = new Date(state.lastUpdated);
            this.uiElements['last-updated'].textContent = `Updated: ${date.toLocaleTimeString()}`;
        }
    }

    #updateControls(state) {
        const loadPlayerBtn = this.uiElements['load-player-items-btn'];
        if (loadPlayerBtn) {
            loadPlayerBtn.disabled = !state.wallet?.isConnected;
        }

        this.#updateCreateOrdersButton();
    }

    // Event Handlers
    async #handleWalletAction() {
        try {
            if (appController.isConnected) {
                await appController.disconnectWallet();
                this.#showSuccess('Wallet disconnected');
            } else {
                await appController.connectWallet();
                this.#showSuccess('Wallet connected successfully');
            }
        } catch (error) {
            this.#showError(`Wallet operation failed: ${error.message}`);
        }
    }

    async #loadItems() {
        try {
            await appController.loadItems();
            this.#showSuccess('Items loaded successfully');
        } catch (error) {
            this.#showError(`Failed to load items: ${error.message}`);
        }
    }

    async #loadMarketOrders() {
        try {
            await appController.loadMarketOrders();
            this.#showSuccess('Market orders loaded');
        } catch (error) {
            this.#showError(`Failed to load market orders: ${error.message}`);
        }
    }

    async #loadPlayerItems() {
        try {
            await appController.loadPlayerItems();
            this.#showSuccess('Player items loaded successfully');
        } catch (error) {
            this.#showError(`Failed to load player items: ${error.message}`);
        }
    }

    async #createSellOrders() {
        if (this.selectedItems.size === 0) {
            this.#showError('Please select items to sell');
            return;
        }

        try {
            // Collect order data
            const orderRequests = [];

            for (const tokenId of this.selectedItems) {
                const row = document.querySelector(`[data-token-id="${tokenId}"]`);
                const qtyInput = row.querySelector('.qty-to-sell-input');
                const priceInput = row.querySelector('.sell-price-input');

                const quantity = parseFloat(qtyInput.value);
                const price = parseFloat(priceInput.value);

                if (quantity > 0 && price > 0) {
                    orderRequests.push({
                        tokenId,
                        amount: quantity,
                        priceInEth: price
                    });
                }
            }

            if (orderRequests.length === 0) {
                this.#showError('No valid orders found. Please check quantities and prices.');
                return;
            }

            // Confirm with user
            const confirmed = await this.#showConfirmDialog(
                'Create Sell Orders',
                `Create ${orderRequests.length} sell orders? This will require blockchain transactions and gas fees.`
            );

            if (!confirmed) return;

            // Create orders
            const result = await appController.createSellOrders(orderRequests);

            if (result.isSuccessful) {
                this.#showSuccess(`Successfully created ${result.ordersCreated} sell orders! Transaction: ${result.txHash}`);

                // Clear selections
                this.selectedItems.clear();
                this.#updateSelectedCount();

                // Refresh UI
                await appController.loadPlayerItems();
            } else {
                this.#showError(`Failed to create orders: ${result.errorMessage}`);
            }

        } catch (error) {
            this.#showError(`Order creation failed: ${error.message}`);
        }
    }

    #handleSelectAll(checked) {
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            if (checkbox.disabled) return;

            checkbox.checked = checked;
            const tokenId = parseInt(checkbox.dataset.tokenId);
            const row = checkbox.closest('.item-row');

            if (checked) {
                this.selectedItems.add(tokenId);
                row.classList.add('selected');
            } else {
                this.selectedItems.delete(tokenId);
                row.classList.remove('selected');
            }
        });

        this.#updateSelectedCount();
        this.#updateCreateOrdersButton();
    }

    #handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'a':
                    e.preventDefault();
                    this.uiElements['select-all-checkbox'].checked = true;
                    this.#handleSelectAll(true);
                    break;
                case 'd':
                    e.preventDefault();
                    this.#toggleDebugPanel();
                    break;
            }
        }
    }

    // UI Utilities
    #showError(message) {
        const banner = this.uiElements['error-banner'];
        if (banner) {
            banner.querySelector('.error-message').textContent = message;
            banner.classList.remove('hidden');
        }
        console.error(message);
    }

    #hideError() {
        this.uiElements['error-banner']?.classList.add('hidden');
    }

    #showSuccess(message) {
        const banner = this.uiElements['success-banner'];
        if (banner) {
            banner.querySelector('.success-message').textContent = message;
            banner.classList.remove('hidden');

            // Auto-hide after 5 seconds
            setTimeout(() => {
                banner.classList.add('hidden');
            }, 5000);
        }
        console.log(message);
    }

    #showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            const confirmed = confirm(`${title}\n\n${message}`);
            resolve(confirmed);
        });
    }

    #showDebugPanel() {
        this.uiElements['debug-panel']?.classList.remove('hidden');
    }

    #toggleDebugPanel() {
        const panel = this.uiElements['debug-panel'];
        if (panel) {
            panel.classList.toggle('hidden');
            const toggle = this.uiElements['debug-toggle'];
            if (toggle) {
                toggle.textContent = panel.classList.contains('hidden') ? 'Show' : 'Hide';
            }
        }
    }

    #clearDebugLog() {
        const output = this.uiElements['debug-output'];
        if (output) {
            output.innerHTML = '';
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new EstforMarketplaceApp();
    app.initialize().catch(console.error);
});

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});