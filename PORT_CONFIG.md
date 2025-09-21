# Port Configuration

## Default Port: 3080

This project is configured to use **port 3080** by default.

### Why Port 3080?
- Avoids conflicts with common development ports (3000, 8080, 8000)
- Easy to remember (30 + 80 = 3080)
- Less likely to be used by other applications

### Starting the Server

**Method 1: Using npm script (recommended)**
```bash
npm run serve
```

**Method 2: Direct Python server**
```bash
python3 -m http.server 3080
```

**Method 3: Node.js server**
```bash
npm start
# or
npm run dev
```

### Access URLs

- **Main Application**: `http://localhost:3080/estfor-items-working.html`
- **Simple Version**: `http://localhost:3080/public/index.html`
- **Marketplace Script**: `http://localhost:3080/src/marketplace.js`

### Important Notes

⚠️ **Always use port 3080** - This is the standardized port for this project.

⚠️ **CORS Requirements** - Some Web3 features require serving from HTTP server rather than opening files directly.

⚠️ **MetaMask Compatibility** - Browser-based wallet connections work best with HTTP server setup.

### Changing the Port

If you need to use a different port:

1. Update `.port` file
2. Update `package.json` serve script
3. Update `src/index.js` PORT constant
4. Update this documentation