// src/utils/url.utils.ts

/**
 * Get the frontend URL dynamically
 * Supports: localhost, Docker, and production domains
 */
export const getFrontendUrl = (): string => {
    // 1. Check environment variable (overrides everything)
    if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL;
    }

    // 2. Production detection
    if (process.env.NODE_ENV === 'production') {
        // Get from request if available, or use default
        return 'https://service-connect.co.za';
    }

    // 3. Docker detection
    if (process.env.DB_HOST === 'postgres' || process.env.REDIS_HOST === 'redis') {
        return 'http://localhost'; // Docker frontend on port 80
    }

    // 4. Default local development
    return 'http://localhost:3000';
};

/**
 * Get the backend URL dynamically
 */
export const getBackendUrl = (): string => {
    if (process.env.APP_URL) {
        return process.env.APP_URL;
    }

    if (process.env.NODE_ENV === 'production') {
        return 'https://api.service-connect.co.za';
    }

    if (process.env.DB_HOST === 'postgres' || process.env.REDIS_HOST === 'redis') {
        return 'http://localhost:3001';
    }

    return 'http://localhost:3001';
};

/**
 * Get webhook URL for payment providers
 */
export const getWebhookUrl = (endpoint: string): string => {
    const backendUrl = getBackendUrl();
    return `${backendUrl}${endpoint}`;
};