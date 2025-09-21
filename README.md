# Estfor Marketplace Integration

A complete web interface for creating batched sell orders on the Estfor marketplace with efficient blockchain transactions on the Sonic network.

## 🚀 Key Features

- **Batched Transactions**: Create multiple orders in a single transaction for maximum efficiency
- **Smart Fallback Logic**: Automatically tries SELL orders first, then BUY orders as backup
- **Real-time Validation**: Balance checks, approval management, and parameter validation
- **Network Management**: Automatic Sonic network switching and connection handling
- **User-friendly Interface**: Real-time debugging, clear feedback, and automatic cleanup
- **Working Transaction Format**: Compatible with Estfor's limitOrders function structure

## ⚡ Efficiency Benefits

- **Reduced Gas Costs**: Single transaction instead of multiple individual transactions
- **Faster Execution**: Atomic operation for all orders
- **Better UX**: All-or-nothing order creation with comprehensive error handling

## Contracts

- **Marketplace Proxy**: `0x0D6D3794C858B512716e77e05588D4f1Fc264319`
- **Implementation**: `0xb16fbc5251da4c4beadc685406ed2b2c5fa5f1a8`
- **Estfor Items (ERC-1155)**: `0x8970c63da309d5359a579c2f53bfd64f72b7b706`

## Setup

1. **Open the HTML file** in a web browser
2. **Connect your wallet** - Make sure you have MetaMask or another Web3 wallet installed
3. **Switch to Sonic Network** - The app will automatically prompt you to add/switch to Sonic

### Sonic Network Details
- **Chain ID**: 146
- **RPC URL**: https://rpc.soniclabs.com
- **Explorer**: https://sonicscan.org

## Usage Instructions

### Step 1: Connect Wallet
1. Click "Connect Wallet" button
2. Approve the connection in your wallet
3. The app will automatically switch to Sonic network if needed

### Step 2: Load Data
1. **Load Items**: Click "Load Orders" to fetch marketplace data and auto-fill sell prices
2. **Load Player Items**: Click "Load Player Items" to see your token balances and auto-fill quantities

### Step 3: Select Items to Sell
1. **Check items**: Use the checkboxes to select items you want to sell
2. **Set quantities**: Adjust the "Qty to sell" if needed (auto-filled with your balance)
3. **Set prices**: Adjust the "Sell Price" if needed (auto-filled with competitive pricing)

### Step 4: Create Sell Orders
1. Click the red "Create Sell Orders" button
2. Review the confirmation dialog showing all selected items
3. Approve each transaction in your wallet
4. Wait for confirmations (transactions are spaced 3 seconds apart)

## Security Features

- **Balance Verification**: Checks your token balance before creating orders
- **Approval Management**: Automatically handles marketplace approval for your tokens
- **Error Handling**: Comprehensive error handling with detailed messages
- **Transaction Confirmation**: Waits for blockchain confirmation before proceeding

## Error Handling

The application handles various error scenarios:

- **Insufficient Balance**: Checks your token balance before creating orders
- **Network Issues**: Automatic network switching and connection recovery
- **Contract Failures**: Tries multiple function names for marketplace compatibility
- **Transaction Failures**: Detailed error reporting and partial success handling

## Function Discovery

The marketplace contract interaction tries multiple common function signatures:
- `createSellOrder(tokenId, amount, price)`
- `sell(tokenId, amount, price)`
- `placeSellOrder(tokenId, amount, pricePerToken)`

This ensures compatibility even if the exact function name is different.

## Debug Output

The application provides detailed debug output in the debug panel showing:
- Connection status
- Contract initialization
- Transaction hashes
- Error messages
- Success confirmations

## Important Notes

� **REAL TRANSACTIONS**: This application creates real blockchain transactions that cost gas fees and create actual sell orders on the marketplace.

� **APPROVALS**: The first transaction will approve the marketplace to spend your tokens (one-time approval for all tokens).

� **PRICING**: Double-check sell prices before confirming - orders will be listed at the exact prices you specify.

� **QUANTITIES**: Ensure you have sufficient token balances for the quantities you're trying to sell.

## Troubleshooting

### Wallet Not Connecting
- Ensure MetaMask is installed and unlocked
- Try refreshing the page
- Check that you're on a supported browser

### Wrong Network
- The app will automatically prompt to switch to Sonic
- Manually add Sonic network if the automatic addition fails

### Transaction Failures
- Check you have sufficient balance
- Ensure you have enough native tokens (S) for gas fees
- Verify marketplace approval was successful

### Contract Function Not Found
- The app tries multiple function names automatically
- If all fail, the marketplace contract may have a different interface

## Files

- `public/index.html` - Basic HTML page that loads items from API
- `estfor-items-working.html` - Full marketplace integration with sell order functionality
- `src/marketplace.js` - Standalone marketplace interaction library
- `src/index.js` - Simple server entry point (serves on port 3080)
- `.port` - Port configuration file (always use port 3080)
- `PORT_CONFIG.md` - Detailed port configuration documentation

## Development

### Default Port: 3080

This project uses **port 3080** by default. Always access the application at `http://localhost:3080`.

To run a local server:
```bash
npm install
npm run serve
```

Or manually:
```bash
python3 -m http.server 3080
```

Then navigate to: `http://localhost:3080/estfor-items-working.html`

The HTML files can also be opened directly in a browser, but using the HTTP server is recommended for proper CORS handling.