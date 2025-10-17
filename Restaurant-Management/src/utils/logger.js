import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = join(__dirname, '../../logs');
if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
}

// Create subdirectories for different log types
const logDirs = ['access', 'errors', 'auth', 'transactions', 'performance'];
logDirs.forEach(dir => {
    const dirPath = join(logsDir, dir);
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }
});

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...meta
        };

        if (stack) {
            logEntry.stack = stack;
        }

        return JSON.stringify(logEntry, null, 2);
    })
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        const stackString = stack ? `\n${stack}` : '';
        return `${timestamp} [${level}]: ${message} ${metaString}${stackString}`;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: {
        service: 'restaurant-management',
        version: process.env.API_VERSION || 'v2',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: []
});

// Add console transport for development
if (process.env.NODE_ENV === 'development' || process.env.ENABLE_CONSOLE_LOG === 'true') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        handleExceptions: true,
        handleRejections: true
    }));
}
// Always add console transport for development
logger.add(new winston.transports.Console({
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
}));
// Add file transports for production
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOG === 'true') {
    // Combined log file
    logger.add(new winston.transports.File({
        filename: join(logsDir, 'combined.log'),
        format: logFormat,
        maxsize: 20 * 1024 * 1024, // 20MB
        maxFiles: 14, // Keep 14 days
        tailable: true
    }));

    // Error log file
    logger.add(new winston.transports.File({
        filename: join(logsDir, 'errors/error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 20 * 1024 * 1024,
        maxFiles: 30,
        tailable: true
    }));

    // Authentication logs
    logger.add(new winston.transports.File({
        filename: join(logsDir, 'auth/auth.log'),
        format: logFormat,
        maxsize: 10 * 1024 * 1024,
        maxFiles: 7,
        tailable: true
    }));
}

// Create specialized loggers
export const authLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    defaultMeta: {
        service: 'restaurant-auth',
        version: process.env.API_VERSION || 'v2'
    },
    transports: [
        new winston.transports.File({
            filename: join(logsDir, 'auth/auth.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 7
        })
    ]
});

export const transactionLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    defaultMeta: {
        service: 'restaurant-transactions',
        version: process.env.API_VERSION || 'v2'
    },
    transports: [
        new winston.transports.File({
            filename: join(logsDir, 'transactions/transactions.log'),
            maxsize: 20 * 1024 * 1024,
            maxFiles: 30
        })
    ]
});

export const performanceLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    defaultMeta: {
        service: 'restaurant-performance',
        version: process.env.API_VERSION || 'v2'
    },
    transports: [
        new winston.transports.File({
            filename: join(logsDir, 'performance/performance.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 7
        })
    ]
});

// Helper methods for structured logging
logger.logAuth = (action, userId, details = {}) => {
    authLogger.info('Authentication event', {
        action,
        userId,
        timestamp: new Date().toISOString(),
        ...details
    });
};

logger.logTransaction = (type, amount, orderId, details = {}) => {
    transactionLogger.info('Transaction event', {
        type,
        amount,
        orderId,
        timestamp: new Date().toISOString(),
        ...details
    });
};

logger.logPerformance = (operation, duration, details = {}) => {
    performanceLogger.info('Performance metric', {
        operation,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        ...details
    });
};

logger.logError = (error, context = {}) => {
    logger.error('Application error', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        timestamp: new Date().toISOString(),
        ...context
    });
};

logger.logSecurity = (event, details = {}) => {
    logger.warn('Security event', {
        event,
        timestamp: new Date().toISOString(),
        ...details
    });
};

// Database query logger
logger.logQuery = (query, duration, success = true, error = null) => {
    const logData = {
        query: query.substring(0, 500), // Limit query length
        duration: `${duration}ms`,
        success,
        timestamp: new Date().toISOString()
    };

    if (error) {
        logData.error = error.message;
        logger.error('Database query failed', logData);
    } else {
        logger.debug('Database query executed', logData);
    }
};

// API request logger
logger.logRequest = (req, res, duration) => {
    const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.id || null,
        timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
        logger.warn('HTTP request completed with error', logData);
    } else {
        logger.info('HTTP request completed', logData);
    }
};

export default logger;