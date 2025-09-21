/**
 * Enterprise Logger
 * Structured logging with multiple levels and output targets
 */
export class Logger {
    static LogLevel = {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3,
        TRACE: 4
    };

    static #instance = null;
    #logLevel = Logger.LogLevel.INFO;
    #outputs = [];

    constructor() {
        if (Logger.#instance) {
            return Logger.#instance;
        }

        this.#setupDefaultOutputs();
        Logger.#instance = this;
    }

    #setupDefaultOutputs() {
        // Console output
        this.#outputs.push({
            name: 'console',
            write: (level, message, data) => {
                const timestamp = new Date().toISOString();
                const levelName = Object.keys(Logger.LogLevel)[level];
                const logMessage = `[${timestamp}] ${levelName}: ${message}`;

                if (data) {
                    console.log(logMessage, data);
                } else {
                    console.log(logMessage);
                }
            }
        });

        // Debug panel output (if exists)
        this.#outputs.push({
            name: 'debugPanel',
            write: (level, message, data) => {
                const debugPanel = document.getElementById('debug-output');
                if (debugPanel) {
                    const timestamp = new Date().toLocaleTimeString();
                    const levelName = Object.keys(Logger.LogLevel)[level];
                    const entry = document.createElement('div');
                    entry.className = `debug-entry debug-${levelName.toLowerCase()}`;

                    let content = `[${timestamp}] ${levelName}: ${message}`;
                    if (data) {
                        content += `\n${JSON.stringify(data, null, 2)}`;
                    }

                    entry.textContent = content;
                    debugPanel.appendChild(entry);
                    debugPanel.scrollTop = debugPanel.scrollHeight;
                }
            }
        });
    }

    setLevel(level) {
        this.#logLevel = level;
    }

    addOutput(name, writeFunction) {
        this.#outputs.push({ name, write: writeFunction });
    }

    removeOutput(name) {
        this.#outputs = this.#outputs.filter(output => output.name !== name);
    }

    #log(level, message, data = null) {
        if (level <= this.#logLevel) {
            this.#outputs.forEach(output => {
                try {
                    output.write(level, message, data);
                } catch (error) {
                    console.error(`Logger output '${output.name}' failed:`, error);
                }
            });
        }
    }

    error(message, data = null) {
        this.#log(Logger.LogLevel.ERROR, message, data);
    }

    warn(message, data = null) {
        this.#log(Logger.LogLevel.WARN, message, data);
    }

    info(message, data = null) {
        this.#log(Logger.LogLevel.INFO, message, data);
    }

    debug(message, data = null) {
        this.#log(Logger.LogLevel.DEBUG, message, data);
    }

    trace(message, data = null) {
        this.#log(Logger.LogLevel.TRACE, message, data);
    }

    // Context-aware logging
    createContext(context) {
        return {
            error: (message, data) => this.error(`[${context}] ${message}`, data),
            warn: (message, data) => this.warn(`[${context}] ${message}`, data),
            info: (message, data) => this.info(`[${context}] ${message}`, data),
            debug: (message, data) => this.debug(`[${context}] ${message}`, data),
            trace: (message, data) => this.trace(`[${context}] ${message}`, data)
        };
    }

    static getInstance() {
        if (!Logger.#instance) {
            new Logger();
        }
        return Logger.#instance;
    }
}

// Export singleton instance
export const logger = Logger.getInstance();