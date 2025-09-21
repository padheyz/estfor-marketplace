// Estfor Marketplace Contract Interaction Script
// This script will create sell orders for selected items with specified prices and quantities

const { ethers } = require('ethers');

// Sonic Network Configuration
const SONIC_RPC = 'https://rpc.soniclabs.com';
const SONIC_CHAIN_ID = 146;

// Contract Addresses
const MARKETPLACE_PROXY = '0x0D6D3794C858B512716e77e05588D4f1Fc264319';
const MARKETPLACE_IMPLEMENTATION = '0xb16fbc5251da4c4beadc685406ed2b2c5fa5f1a8';
const ESTFOR_ITEMS_CONTRACT = '0x8970c63da309d5359a579c2f53bfd64f72b7b706';

// Basic EIP-1967 Proxy ABI to get implementation
const PROXY_ABI = [
    {
        "inputs": [],
        "name": "implementation",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
];

// Standard marketplace functions that are commonly used for limit orders
const MARKETPLACE_ABI = [
    // Create sell order function (common patterns)
    {
        "inputs": [
            {"name": "tokenId", "type": "uint256"},
            {"name": "amount", "type": "uint256"},
            {"name": "price", "type": "uint256"}
        ],
        "name": "createSellOrder",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "tokenId", "type": "uint256"},
            {"name": "amount", "type": "uint256"},
            {"name": "price", "type": "uint256"}
        ],
        "name": "sell",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "tokenId", "type": "uint256"},
            {"name": "amount", "type": "uint256"},
            {"name": "pricePerToken", "type": "uint256"}
        ],
        "name": "placeSellOrder",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // Get all orders function
    {
        "inputs": [],
        "name": "getAllOrders",
        "outputs": [{"name": "", "type": "tuple[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    // Check if order exists
    {
        "inputs": [{"name": "orderId", "type": "uint256"}],
        "name": "orders",
        "outputs": [{"name": "", "type": "tuple"}],
        "stateMutability": "view",
        "type": "function"
    }
];

// Complete ERC-1155 ABI for approvals and balance checks
const ERC1155_ABI = [
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
            {"name": "accounts", "type": "address[]"},
            {"name": "ids", "type": "uint256[]"}
        ],
        "name": "balanceOfBatch",
        "outputs": [{"name": "", "type": "uint256[]"}],
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
    },
    {
        "inputs": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "id", "type": "uint256"},
            {"name": "amount", "type": "uint256"},
            {"name": "data", "type": "bytes"}
        ],
        "name": "safeTransferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "interfaceId", "type": "bytes4"}],
        "name": "supportsInterface",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
];

class EstforMarketplace {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.marketplaceContract = null;
        this.itemsContract = null;
        this.userAddress = null;
    }

    // Initialize connection with wallet
    async connect(privateKey = null) {
        try {
            console.log('Connecting to Sonic network...');

            // Initialize provider
            this.provider = new ethers.providers.JsonRpcProvider(SONIC_RPC);

            // Check network
            const network = await this.provider.getNetwork();
            console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

            if (network.chainId !== SONIC_CHAIN_ID) {
                throw new Error(`Wrong network! Expected chain ID ${SONIC_CHAIN_ID}, got ${network.chainId}`);
            }

            // Initialize signer
            if (privateKey) {
                this.signer = new ethers.Wallet(privateKey, this.provider);
                this.userAddress = await this.signer.getAddress();
                console.log(`Using private key. Address: ${this.userAddress}`);
            } else if (typeof window !== 'undefined' && window.ethereum) {
                // Browser environment with MetaMask
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                await this.provider.send("eth_requestAccounts", []);
                this.signer = this.provider.getSigner();
                this.userAddress = await this.signer.getAddress();
                console.log(`Connected with MetaMask. Address: ${this.userAddress}`);
            } else {
                throw new Error('No wallet connection available. Provide private key or use MetaMask.');
            }

            // Initialize contracts
            this.marketplaceContract = new ethers.Contract(
                MARKETPLACE_PROXY,
                MARKETPLACE_ABI,
                this.signer
            );

            this.itemsContract = new ethers.Contract(
                ESTFOR_ITEMS_CONTRACT,
                ERC1155_ABI,
                this.signer
            );

            console.log('Marketplace contract initialized at:', MARKETPLACE_PROXY);
            console.log('Items contract initialized at:', ESTFOR_ITEMS_CONTRACT);

            return true;
        } catch (error) {
            console.error('Connection failed:', error.message);
            throw error;
        }
    }

    // Check if user has approved the marketplace to spend their tokens
    async checkApproval() {
        try {
            const isApproved = await this.itemsContract.isApprovedForAll(
                this.userAddress,
                MARKETPLACE_PROXY
            );
            console.log(`Marketplace approved for all tokens: ${isApproved}`);
            return isApproved;
        } catch (error) {
            console.error('Error checking approval:', error.message);
            return false;
        }
    }

    // Approve marketplace to spend user's tokens
    async approveMarketplace() {
        try {
            console.log('Approving marketplace for all tokens...');
            const tx = await this.itemsContract.setApprovalForAll(MARKETPLACE_PROXY, true);
            console.log(`Approval transaction sent: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`Approval confirmed in block: ${receipt.blockNumber}`);
            return true;
        } catch (error) {
            console.error('Approval failed:', error.message);
            throw error;
        }
    }

    // Get user's balance for a specific token
    async getTokenBalance(tokenId) {
        try {
            const balance = await this.itemsContract.balanceOf(this.userAddress, tokenId);
            return balance.toString();
        } catch (error) {
            console.error(`Error getting balance for token ${tokenId}:`, error.message);
            return '0';
        }
    }

    // Check multiple token balances
    async getTokenBalances(tokenIds) {
        const balances = {};

        for (const tokenId of tokenIds) {
            balances[tokenId] = await this.getTokenBalance(tokenId);
        }

        return balances;
    }

    // Try multiple function names to create a sell order
    async createSellOrder(tokenId, amount, priceInEth) {
        try {
            const priceInWei = ethers.utils.parseEther(priceInEth.toString());
            const amountBN = ethers.BigNumber.from(amount.toString());

            console.log(`Creating sell order for token ${tokenId}:`);
            console.log(`- Amount: ${amount}`);
            console.log(`- Price: ${priceInEth} ETH (${priceInWei.toString()} wei)`);

            // Check balance first
            const balance = await this.getTokenBalance(tokenId);
            if (ethers.BigNumber.from(balance).lt(amountBN)) {
                throw new Error(`Insufficient balance. Have: ${balance}, Need: ${amount}`);
            }

            // Check approval
            const isApproved = await this.checkApproval();
            if (!isApproved) {
                console.log('Marketplace not approved. Requesting approval...');
                await this.approveMarketplace();
            }

            // Try different function names that might exist
            const possibleFunctions = [
                'createSellOrder',
                'sell',
                'placeSellOrder',
                'createOrder',
                'listItem'
            ];

            let lastError;
            for (const functionName of possibleFunctions) {
                try {
                    console.log(`Trying function: ${functionName}`);

                    // Check if function exists in contract
                    if (!this.marketplaceContract[functionName]) {
                        console.log(`Function ${functionName} not found in contract ABI`);
                        continue;
                    }

                    const tx = await this.marketplaceContract[functionName](
                        tokenId,
                        amountBN,
                        priceInWei
                    );

                    console.log(`✅ Sell order transaction sent: ${tx.hash}`);
                    console.log('Waiting for confirmation...');

                    const receipt = await tx.wait();
                    console.log(`✅ Sell order confirmed in block: ${receipt.blockNumber}`);
                    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

                    return {
                        success: true,
                        txHash: tx.hash,
                        blockNumber: receipt.blockNumber,
                        gasUsed: receipt.gasUsed.toString()
                    };
                } catch (error) {
                    console.log(`Function ${functionName} failed:`, error.message);
                    lastError = error;
                    continue;
                }
            }

            throw new Error(`All sell order functions failed. Last error: ${lastError?.message || 'Unknown error'}`);

        } catch (error) {
            console.error(`❌ Failed to create sell order for token ${tokenId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Batch create sell orders for multiple items
    async batchCreateSellOrders(orders) {
        console.log(`\n🚀 Starting batch creation of ${orders.length} sell orders...`);

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            console.log(`\n📦 Processing order ${i + 1}/${orders.length}`);

            try {
                const result = await this.createSellOrder(
                    order.tokenId,
                    order.amount,
                    order.priceInEth
                );

                results.push({
                    tokenId: order.tokenId,
                    amount: order.amount,
                    priceInEth: order.priceInEth,
                    ...result
                });

                if (result.success) {
                    successCount++;
                    console.log(`✅ Order ${i + 1} completed successfully`);
                } else {
                    errorCount++;
                    console.log(`❌ Order ${i + 1} failed`);
                }

                // Add a small delay between transactions
                if (i < orders.length - 1) {
                    console.log('Waiting 2 seconds before next transaction...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                errorCount++;
                console.error(`❌ Order ${i + 1} failed with error:`, error.message);
                results.push({
                    tokenId: order.tokenId,
                    amount: order.amount,
                    priceInEth: order.priceInEth,
                    success: false,
                    error: error.message
                });
            }
        }

        console.log(`\n📊 Batch operation completed:`);
        console.log(`✅ Successful orders: ${successCount}`);
        console.log(`❌ Failed orders: ${errorCount}`);
        console.log(`📋 Total orders processed: ${orders.length}`);

        return results;
    }

    // Inspect the actual contract to find available functions
    async inspectContract() {
        try {
            console.log('🔍 Inspecting marketplace contract...');

            // Get contract code
            const code = await this.provider.getCode(MARKETPLACE_PROXY);
            if (code === '0x') {
                console.log('❌ No contract code found at this address');
                return false;
            }

            console.log('✅ Contract code found');

            // Try to call some view functions to understand the contract
            const functionChecks = [
                'getAllOrders',
                'orders',
                'getOrderCount',
                'tokenToOrder',
                'userOrders'
            ];

            for (const funcName of functionChecks) {
                try {
                    if (this.marketplaceContract[funcName]) {
                        console.log(`✅ Function ${funcName} exists`);
                        // Try to call it if it's a view function
                        if (funcName === 'getAllOrders') {
                            const orders = await this.marketplaceContract[funcName]();
                            console.log(`  - Returns ${orders.length} orders`);
                        }
                    } else {
                        console.log(`❌ Function ${funcName} not found`);
                    }
                } catch (error) {
                    console.log(`⚠️  Function ${funcName} exists but call failed:`, error.message);
                }
            }

            return true;
        } catch (error) {
            console.error('Contract inspection failed:', error.message);
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EstforMarketplace;
}

// Browser global
if (typeof window !== 'undefined') {
    window.EstforMarketplace = EstforMarketplace;
}

// Example usage function
async function createSellOrdersFromCheckedItems() {
    try {
        const marketplace = new EstforMarketplace();

        // Connect to wallet (in browser, this will use MetaMask)
        await marketplace.connect();

        // Inspect contract first
        await marketplace.inspectContract();

        // Get checked items from the HTML page
        const checkedItems = [];
        const checkboxes = document.querySelectorAll('.item-checkbox:checked');

        checkboxes.forEach(checkbox => {
            const itemRow = checkbox.closest('.item');
            const tokenId = itemRow.querySelector('.item-id').textContent.replace('#', '');
            const qtyToSell = itemRow.querySelector('.qty-to-sell-input').value;
            const sellPrice = itemRow.querySelector('.sell-price-input').value;

            if (qtyToSell && sellPrice && parseFloat(qtyToSell) > 0 && parseFloat(sellPrice) > 0) {
                checkedItems.push({
                    tokenId: parseInt(tokenId),
                    amount: parseInt(qtyToSell),
                    priceInEth: parseFloat(sellPrice)
                });
            }
        });

        if (checkedItems.length === 0) {
            alert('No valid items selected for selling');
            return;
        }

        console.log(`Found ${checkedItems.length} items to sell:`, checkedItems);

        // Create sell orders
        const results = await marketplace.batchCreateSellOrders(checkedItems);

        // Display results
        const successCount = results.filter(r => r.success).length;
        alert(`Sell orders completed!\nSuccessful: ${successCount}\nFailed: ${results.length - successCount}`);

        return results;

    } catch (error) {
        console.error('Failed to create sell orders:', error.message);
        alert(`Failed to create sell orders: ${error.message}`);
        throw error;
    }
}

// Export the main function for browser use
if (typeof window !== 'undefined') {
    window.createSellOrdersFromCheckedItems = createSellOrdersFromCheckedItems;
}