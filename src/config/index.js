/**
 * Application Configuration Management
 * Centralized configuration with environment support and security
 */

export class ConfigManager {
    static #instance = null;
    #config = null;
    #environment = 'production';

    constructor() {
        if (ConfigManager.#instance) {
            return ConfigManager.#instance;
        }

        this.#environment = this.#detectEnvironment();
        this.#config = this.#loadConfiguration();
        ConfigManager.#instance = this;
    }

    #detectEnvironment() {
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('local')) {
                return 'development';
            }
        }
        return 'production';
    }

    #loadConfiguration() {
        const baseConfig = {
            // Blockchain Networks
            networks: {
                sonic: {
                    chainId: 146,
                    name: 'Sonic Network',
                    rpcUrl: 'https://rpc.soniclabs.com',
                    explorerUrl: 'https://sonicscan.org',
                    currency: {
                        name: 'Sonic',
                        symbol: 'S',
                        decimals: 18
                    }
                }
            },

            // Smart Contracts (read-only, no private keys)
            contracts: {
                marketplace: {
                    proxy: '0x0D6D3794C858B512716e77e05588D4f1Fc264319',
                    implementation: '0xb16fbc5251da4c4beadc685406ed2b2c5fa5f1a8'
                },
                items: {
                    address: '0x8970c63da309d5359a579c2f53bfd64f72b7b706',
                    type: 'ERC1155'
                }
            },

            // API Configuration
            api: {
                estfor: {
                    baseUrl: 'https://api.estfor.com',
                    timeout: 10000,
                    retryAttempts: 3,
                    retryDelay: 1000
                }
            },

            // Application Settings
            app: {
                name: 'Estfor Marketplace',
                version: '1.0.0',

                // Transaction Settings
                transaction: {
                    gasBufferPercent: 20,
                    maxRetries: 3,
                    retryDelay: 2000,
                    maxBatchSize: 50
                },

                // UI Settings
                ui: {
                    itemsPerPage: 100,
                    refreshInterval: 30000,
                    notificationDuration: 5000,
                    debounceDelay: 500
                },

                // Security Settings
                security: {
                    maxInputLength: 1000,
                    allowedImageDomains: ['api.estfor.com', 'assets.estfor.com'],
                    csrfProtection: true,
                    sanitizeInputs: true
                }
            },

            // Validation Rules
            validation: {
                price: {
                    min: 0.000001,
                    max: 1000000,
                    decimals: 18
                },
                quantity: {
                    min: 1,
                    max: 16777215 // uint24 max
                },
                tokenId: {
                    min: 1,
                    max: Number.MAX_SAFE_INTEGER
                }
            }
        };

        // Environment-specific overrides
        const envConfig = this.#getEnvironmentConfig();
        return this.#deepMerge(baseConfig, envConfig);
    }

    #getEnvironmentConfig() {
        const configs = {
            development: {
                app: {
                    debug: true,
                    ui: {
                        refreshInterval: 10000 // Faster refresh in dev
                    }
                },
                api: {
                    estfor: {
                        timeout: 30000 // Longer timeout for dev
                    }
                }
            },
            production: {
                app: {
                    debug: false
                }
            }
        };

        return configs[this.#environment] || {};
    }

    #deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.#deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    get(path) {
        return this.#getNestedValue(this.#config, path);
    }

    #getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    getEnvironment() {
        return this.#environment;
    }

    isProduction() {
        return this.#environment === 'production';
    }

    isDevelopment() {
        return this.#environment === 'development';
    }

    // Secure access to sensitive data
    getContractAddress(contractName) {
        const address = this.get(`contracts.${contractName}.address`) ||
                       this.get(`contracts.${contractName}.proxy`);

        if (!address) {
            throw new Error(`Contract address not found: ${contractName}`);
        }

        return address;
    }

    static getInstance() {
        if (!ConfigManager.#instance) {
            new ConfigManager();
        }
        return ConfigManager.#instance;
    }
}

// Export singleton instance
export const config = ConfigManager.getInstance();