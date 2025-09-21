/**
 * Marketplace Service
 * Core business logic for marketplace operations
 */

import { config } from '../config/index.js';
import { walletService } from './WalletService.js';
import { MarketOrder, TransactionResult } from '../models/index.js';
import { validator } from '../security/InputValidator.js';

export class MarketplaceService {
    static #instance = null;
    #contract = null;
    #itemsContract = null;

    // ABIs
    #MARKETPLACE_ABI = [
        {
            "inputs": [
                {
                    "components": [
                        {"internalType": "enum IOrderBook.OrderSide", "name": "side", "type": "uint8"},
                        {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
                        {"internalType": "uint72", "name": "price", "type": "uint72"},
                        {"internalType": "uint24", "name": "quantity", "type": "uint24"}
                    ],
                    "internalType": "struct IOrderBook.LimitOrder[]",
                    "name": "orders",
                    "type": "tuple[]"
                }
            ],
            "name": "limitOrders",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
            "name": "getLowestAsk",
            "outputs": [{"internalType": "uint72", "name": "", "type": "uint72"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
            "name": "getHighestBid",
            "outputs": [{"internalType": "uint72", "name": "", "type": "uint72"}],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    #ERC1155_ABI = [
        {
            "inputs": [
                {"name": "account", "type": "address"},
                {"name": "id", "type": "uint256"}
            ],
            "name": "balanceOf",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {"name": "operator", "type": "address"},
                {"name": "approved", "type": "bool"}
            ],
            "name": "setApprovalForAll",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {"name": "account", "type": "address"},
                {"name": "operator", "type": "address"}
            ],
            "name": "isApprovedForAll",
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    constructor() {
        if (MarketplaceService.#instance) {
            return MarketplaceService.#instance;
        }

        this.#initializeContracts();
        MarketplaceService.#instance = this;
    }

    #initializeContracts() {
        if (!walletService.isConnected || !walletService.provider) {
            return;
        }

        try {
            const marketplaceAddress = config.getContractAddress('marketplace');
            const itemsAddress = config.getContractAddress('items');

            this.#contract = new ethers.Contract(
                marketplaceAddress,
                this.#MARKETPLACE_ABI,
                walletService.signer
            );

            this.#itemsContract = new ethers.Contract(
                itemsAddress,
                this.#ERC1155_ABI,
                walletService.signer
            );

        } catch (error) {
            console.error('Failed to initialize contracts:', error);
            throw new Error('Failed to initialize marketplace contracts');
        }
    }

    async createBatchOrders(orderRequests) {
        try {
            // Rate limiting check
            const rateLimitCheck = validator.checkRateLimit(
                `batch-orders-${walletService.address}`,
                5, // 5 requests
                60000 // per minute
            );

            if (!rateLimitCheck.allowed) {
                throw new Error(`Rate limit exceeded. Try again in ${rateLimitCheck.resetTime} seconds.`);
            }

            // Validate wallet connection
            if (!walletService.isConnected) {
                throw new Error('Wallet not connected');
            }

            if (!walletService.connection.isOnCorrectNetwork) {
                await walletService.switchNetwork();
            }

            // Re-initialize contracts if needed
            if (!this.#contract) {
                this.#initializeContracts();
            }

            // Validate and transform orders
            const validatedOrders = await this.#validateAndPrepareOrders(orderRequests);

            if (validatedOrders.length === 0) {
                throw new Error('No valid orders to create');
            }

            // Check and handle approvals
            await this.#ensureApprovals(validatedOrders);

            // Create orders using the limitOrders function
            const result = await this.#executeBatchTransaction(validatedOrders);

            return new TransactionResult({
                success: true,
                txHash: result.txHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed,
                ordersCreated: validatedOrders.length,
                timestamp: Date.now()
            });

        } catch (error) {
            return new TransactionResult({
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    async #validateAndPrepareOrders(orderRequests) {
        const validatedOrders = [];
        const maxBatchSize = config.get('app.transaction.maxBatchSize');

        if (orderRequests.length > maxBatchSize) {
            throw new Error(`Too many orders. Maximum ${maxBatchSize} orders per batch.`);
        }

        for (const request of orderRequests) {
            try {
                // Create and validate order model
                const order = new MarketOrder({
                    tokenId: request.tokenId,
                    side: request.side || 'sell',
                    price: request.priceInEth,
                    quantity: request.amount,
                    user: walletService.address
                });

                // Check user balance
                const balance = await this.#getUserBalance(order.tokenId);
                const balanceCheck = balance.canSell(order.quantity);

                if (!balanceCheck.canSell) {
                    throw new Error(`${balanceCheck.reason} for token ${order.tokenId}`);
                }

                // Convert to contract format
                const contractOrder = {
                    side: order.sideNumeric,
                    tokenId: order.tokenId,
                    price: ethers.utils.parseEther(order.price.toString()),
                    quantity: ethers.BigNumber.from(order.quantity)
                };

                // Validate contract limits
                this.#validateContractLimits(contractOrder);

                validatedOrders.push(contractOrder);

            } catch (error) {
                console.error(`Order validation failed for token ${request.tokenId}:`, error);
                // Continue with other orders instead of failing entire batch
            }
        }

        return validatedOrders;
    }

    #validateContractLimits(order) {
        const MAX_UINT72 = ethers.BigNumber.from('0xFFFFFFFFFFFFFFFFFF');
        const MAX_UINT24 = ethers.BigNumber.from('0xFFFFFF');

        if (order.price.gt(MAX_UINT72)) {
            throw new Error(`Price exceeds maximum allowed value`);
        }

        if (order.quantity.gt(MAX_UINT24)) {
            throw new Error(`Quantity exceeds maximum allowed value (${MAX_UINT24.toString()})`);
        }

        if (order.price.lte(0)) {
            throw new Error('Price must be greater than 0');
        }

        if (order.quantity.lte(0)) {
            throw new Error('Quantity must be greater than 0');
        }
    }

    async #getUserBalance(tokenId) {
        try {
            const balance = await this.#itemsContract.balanceOf(walletService.address, tokenId);
            return new (await import('../models/index.js')).UserBalance({
                tokenId,
                balance: balance.toString()
            });
        } catch (error) {
            console.error(`Failed to get balance for token ${tokenId}:`, error);
            return new (await import('../models/index.js')).UserBalance({
                tokenId,
                balance: 0
            });
        }
    }

    async #ensureApprovals(orders) {
        try {
            const isApproved = await this.#itemsContract.isApprovedForAll(
                walletService.address,
                config.getContractAddress('marketplace')
            );

            if (!isApproved) {
                const tx = await this.#itemsContract.setApprovalForAll(
                    config.getContractAddress('marketplace'),
                    true
                );

                await tx.wait();
            }

        } catch (error) {
            throw new Error(`Failed to approve marketplace: ${error.message}`);
        }
    }

    async #executeBatchTransaction(orders) {
        const gasBufferPercent = config.get('app.transaction.gasBufferPercent');
        const maxRetries = config.get('app.transaction.maxRetries');

        let lastError;

        // Try SELL orders first
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const gasEstimate = await this.#contract.estimateGas.limitOrders(orders);
                const gasLimit = gasEstimate.mul(100 + gasBufferPercent).div(100);

                const tx = await this.#contract.limitOrders(orders, { gasLimit });
                const receipt = await tx.wait();

                return {
                    txHash: tx.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString()
                };

            } catch (error) {
                lastError = error;
                console.warn(`Batch transaction attempt ${attempt + 1} failed:`, error.message);

                if (attempt < maxRetries - 1) {
                    await this.#delay(config.get('app.transaction.retryDelay'));
                }
            }
        }

        // If SELL orders failed, try BUY orders as fallback
        const buyOrders = orders.map(order => ({ ...order, side: 1 }));

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const gasEstimate = await this.#contract.estimateGas.limitOrders(buyOrders);
                const gasLimit = gasEstimate.mul(100 + gasBufferPercent).div(100);

                const tx = await this.#contract.limitOrders(buyOrders, { gasLimit });
                const receipt = await tx.wait();

                return {
                    txHash: tx.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString(),
                    note: 'Created BUY orders instead of SELL orders'
                };

            } catch (error) {
                lastError = error;
                console.warn(`BUY orders attempt ${attempt + 1} failed:`, error.message);

                if (attempt < maxRetries - 1) {
                    await this.#delay(config.get('app.transaction.retryDelay'));
                }
            }
        }

        throw new Error(`All transaction attempts failed: ${lastError?.message || 'Unknown error'}`);
    }

    #delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Market data methods
    async getLowestAsk(tokenId) {
        try {
            const price = await this.#contract.getLowestAsk(tokenId);
            return ethers.utils.formatEther(price);
        } catch (error) {
            return null;
        }
    }

    async getHighestBid(tokenId) {
        try {
            const price = await this.#contract.getHighestBid(tokenId);
            return ethers.utils.formatEther(price);
        } catch (error) {
            return null;
        }
    }

    static getInstance() {
        if (!MarketplaceService.#instance) {
            new MarketplaceService();
        }
        return MarketplaceService.#instance;
    }
}

export const marketplaceService = MarketplaceService.getInstance();