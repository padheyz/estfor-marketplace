/**
 * Wallet Service
 * Handles all wallet interactions with proper error handling and security
 */

import { config } from '../config/index.js';
import { WalletConnection } from '../models/index.js';

export class WalletService {
    static #instance = null;
    #provider = null;
    #signer = null;
    #connection = null;
    #eventListeners = new Set();

    constructor() {
        if (WalletService.#instance) {
            return WalletService.#instance;
        }

        this.#setupEventListeners();
        WalletService.#instance = this;
    }

    #setupEventListeners() {
        if (typeof window !== 'undefined' && window.ethereum) {
            // Account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                this.#handleAccountChange(accounts);
            });

            // Network changes
            window.ethereum.on('chainChanged', (chainId) => {
                this.#handleNetworkChange(chainId);
            });

            // Connection events
            window.ethereum.on('connect', (connectInfo) => {
                this.#handleConnect(connectInfo);
            });

            window.ethereum.on('disconnect', (error) => {
                this.#handleDisconnect(error);
            });
        }
    }

    async connect() {
        try {
            if (!this.#isWalletAvailable()) {
                throw new Error('No Web3 wallet detected. Please install MetaMask or similar wallet.');
            }

            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please unlock your wallet.');
            }

            // Initialize provider and signer
            this.#provider = new ethers.providers.Web3Provider(window.ethereum);
            this.#signer = this.#provider.getSigner();

            // Get network info
            const network = await this.#provider.getNetwork();

            // Create connection model
            this.#connection = new WalletConnection({
                address: accounts[0],
                isConnected: true,
                chainId: network.chainId,
                walletType: this.#detectWalletType(),
                lastConnected: Date.now()
            });

            // Check if we're on the correct network
            await this.#ensureCorrectNetwork();

            this.#notifyListeners('connected', this.#connection);

            return this.#connection;

        } catch (error) {
            this.#connection = new WalletConnection({
                isConnected: false,
                error: error.message
            });

            this.#notifyListeners('error', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            this.#provider = null;
            this.#signer = null;
            this.#connection = new WalletConnection({
                isConnected: false
            });

            this.#notifyListeners('disconnected', this.#connection);

        } catch (error) {
            this.#notifyListeners('error', error);
            throw error;
        }
    }

    async switchNetwork() {
        try {
            const sonicConfig = config.get('networks.sonic');

            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${sonicConfig.chainId.toString(16)}` }]
            });

        } catch (switchError) {
            // If the network doesn't exist, add it
            if (switchError.code === 4902) {
                await this.#addNetwork();
            } else {
                throw switchError;
            }
        }
    }

    async #addNetwork() {
        const sonicConfig = config.get('networks.sonic');

        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: `0x${sonicConfig.chainId.toString(16)}`,
                chainName: sonicConfig.name,
                rpcUrls: [sonicConfig.rpcUrl],
                blockExplorerUrls: [sonicConfig.explorerUrl],
                nativeCurrency: sonicConfig.currency
            }]
        });
    }

    async #ensureCorrectNetwork() {
        const expectedChainId = config.get('networks.sonic.chainId');

        if (!this.#connection.isOnCorrectNetwork) {
            const shouldSwitch = confirm(
                `You're connected to chain ${this.#connection.chainId}, but this app requires Sonic Network (${expectedChainId}). Switch networks?`
            );

            if (shouldSwitch) {
                await this.switchNetwork();
            } else {
                throw new Error(`Please switch to Sonic Network (Chain ID: ${expectedChainId})`);
            }
        }
    }

    #isWalletAvailable() {
        return typeof window !== 'undefined' &&
               typeof window.ethereum !== 'undefined' &&
               window.ethereum.isMetaMask !== undefined;
    }

    #detectWalletType() {
        if (window.ethereum?.isMetaMask) return 'MetaMask';
        if (window.ethereum?.isTrust) return 'Trust Wallet';
        if (window.ethereum?.isImToken) return 'imToken';
        return 'Unknown';
    }

    #handleAccountChange(accounts) {
        if (accounts.length === 0) {
            this.disconnect();
        } else if (this.#connection && accounts[0] !== this.#connection.address) {
            // Account changed, reconnect
            this.connect();
        }
    }

    #handleNetworkChange(chainId) {
        if (this.#connection) {
            this.#connection = new WalletConnection({
                ...this.#connection,
                chainId: parseInt(chainId, 16)
            });

            this.#notifyListeners('networkChanged', this.#connection);

            // Check if we need to switch back to Sonic
            if (!this.#connection.isOnCorrectNetwork) {
                this.#notifyListeners('wrongNetwork', this.#connection);
            }
        }
    }

    #handleConnect(connectInfo) {
        this.#notifyListeners('walletConnected', connectInfo);
    }

    #handleDisconnect(error) {
        this.disconnect();
        this.#notifyListeners('walletDisconnected', error);
    }

    // Event system for UI updates
    addEventListener(event, callback) {
        this.#eventListeners.add({ event, callback });
    }

    removeEventListener(event, callback) {
        this.#eventListeners.forEach(listener => {
            if (listener.event === event && listener.callback === callback) {
                this.#eventListeners.delete(listener);
            }
        });
    }

    #notifyListeners(event, data) {
        this.#eventListeners.forEach(listener => {
            if (listener.event === event) {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error('Wallet event listener error:', error);
                }
            }
        });
    }

    // Getters
    get connection() {
        return this.#connection;
    }

    get provider() {
        return this.#provider;
    }

    get signer() {
        return this.#signer;
    }

    get isConnected() {
        return this.#connection?.isConnected || false;
    }

    get address() {
        return this.#connection?.address || null;
    }

    get chainId() {
        return this.#connection?.chainId || null;
    }

    static getInstance() {
        if (!WalletService.#instance) {
            new WalletService();
        }
        return WalletService.#instance;
    }
}

export const walletService = WalletService.getInstance();