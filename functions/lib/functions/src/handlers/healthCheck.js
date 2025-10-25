"use strict";
// functions/src/handlers/healthCheck.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthDetailed = exports.health = void 0;
const https_1 = require("firebase-functions/v2/https");
// ==================== HEALTH CHECK HANDLER ====================
/**
 * Health Check Function
 * Returns a simple status to confirm the service is running
 *
 * Usage: GET https://your-api.com/health
 *
 * This is useful for:
 * - Monitoring services (checking if your API is up)
 * - Load balancers (checking server health)
 * - Debugging (quick way to test if functions are deployed)
 */
exports.health = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    try {
        // Get current timestamp
        const timestamp = new Date().toISOString();
        // Calculate uptime (if needed)
        const uptime = process.uptime();
        // Create response
        const response = {
            status: 'OK',
            timestamp,
            uptime: Math.floor(uptime), // Seconds since function started
        };
        console.log('✅ Health check - all systems operational');
        // Return successful response
        res.status(200).json(response);
    }
    catch (error) {
        // If something goes wrong, return error status
        console.error('❌ Health check failed:', error);
        const errorResponse = {
            status: 'ERROR',
            timestamp: new Date().toISOString(),
        };
        res.status(503).json(errorResponse);
    }
});
/**
 * Advanced Health Check (Optional)
 * You could expand this to check database connectivity, etc.
 */
exports.healthDetailed = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    try {
        const checks = {
            timestamp: new Date().toISOString(),
            status: 'OK',
            services: {
                functions: 'operational',
                // You could add more checks here:
                // database: await checkDatabaseConnection(),
                // externalAPI: await checkExternalAPI(),
            },
            uptime: Math.floor(process.uptime()),
        };
        res.status(200).json(checks);
    }
    catch (error) {
        console.error('❌ Detailed health check failed:', error);
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: 'Service unavailable',
        });
    }
});
//# sourceMappingURL=healthCheck.js.map