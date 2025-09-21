/**
 * Application Configuration
 * Enterprise-grade configuration management with environment support
 */
export class AppConfig {
    static #instance = null;
    #config = null;

    constructor() {
        if (AppConfig.#instance) {
            return AppConfig.#instance;
        }

        this.#config = this.#loadConfiguration();
        AppConfig.#instance = this;
    }

    #loadConfiguration() {
        return {
            // Blockchain Configuration
            blockchain: {
                sonic: {
                    chainId: 146,
                    rpcUrl: 'https://rpc.soniclabs.com',
                    explorer: 'https://sonicscan.org',
                    name: 'Sonic Network'
                }
            },

            // Contract Addresses
            contracts: {
                marketplace: {
                    proxy: '0x0D6D3794C858B512716e77e05588D4f1Fc264319',
                    implementation: '0xb16fbc5251da4c4beadc685406ed2b2c5fa5f1a8'
                },
                items: {
                    address: '0x8970c63da309d5359a579c2f53bfd64f72b7b706'
                }
            },

            // API Configuration
            api: {
                estfor: {
                    baseUrl: 'https://api.estfor.com',
                    endpoints: {
                        items: '/items',
                        orders: '/orders',
                        playerItems: '/players'
                    },
                    timeout: 10000
                }
            },

            // Application Settings
            app: {
                name: 'Estfor Marketplace',
                version: '1.0.0',
                port: 3080,
                debug: process?.env?.NODE_ENV !== 'production',

                // Transaction Settings
                transaction: {
                    gasMultiplier: 1.2, // 20% buffer
                    retryAttempts: 3,
                    retryDelay: 2000,
                    batchSize: 50 // Maximum orders per batch
                },

                // UI Settings
                ui: {
                    itemsPerPage: 100,
                    autoRefreshInterval: 30000,
                    notificationTimeout: 5000
                }
            },

            // Validation Rules
            validation: {
                price: {
                    min: 0.000001, // Minimum price in ETH
                    max: 1000000,  // Maximum price in ETH
                    decimals: 18
                },
                quantity: {
                    min: 1,
                    max: 16777215 // uint24 max
                }
            }
        };
    }

    get(path) {
        return this.#getNestedValue(this.#config, path);
    }

    #getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    // Singleton access
    static getInstance() {
        if (!AppConfig.#instance) {
            new AppConfig();
        }
        return AppConfig.#instance;
    }

    // Environment-specific overrides
    static configure(overrides = {}) {
        const instance = AppConfig.getInstance();
        instance.#config = { ...instance.#config, ...overrides };
        return instance;
    }
}

// Export singleton instance
export const config = AppConfig.getInstance();