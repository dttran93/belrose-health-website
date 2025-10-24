// functions/src/handlers/healthCheck.ts

import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';

/**
 * Health Check Handler
 * Simple endpoint to verify that the cloud functions are running
 */

// ==================== TYPE DEFINITIONS ====================

interface HealthCheckResponse {
  status: 'OK' | 'ERROR';
  timestamp: string;
  version?: string;
  uptime?: number;
}

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
export const health = onRequest({ cors: true }, async (req: Request, res: Response) => {
  try {
    // Get current timestamp
    const timestamp = new Date().toISOString();

    // Calculate uptime (if needed)
    const uptime = process.uptime();

    // Create response
    const response: HealthCheckResponse = {
      status: 'OK',
      timestamp,
      uptime: Math.floor(uptime), // Seconds since function started
    };

    console.log('✅ Health check - all systems operational');

    // Return successful response
    res.status(200).json(response);
  } catch (error) {
    // If something goes wrong, return error status
    console.error('❌ Health check failed:', error);

    const errorResponse: HealthCheckResponse = {
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
export const healthDetailed = onRequest({ cors: true }, async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('❌ Detailed health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
});
