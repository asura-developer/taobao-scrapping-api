const express = require('express');
const router = express.Router();
const ScrapingJob = require('../models/ScrapingJob.model');

/**
 * GET /api/debug/job/:jobId
 * Get detailed job information including errors
 */
router.get('/job/:jobId', async (req, res, next) => {
    try {
        const job = await ScrapingJob.findOne({ jobId: req.params.jobId }).lean();

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        res.json({
            success: true,
            data: {
                ...job,
                errorDetails: job.error ? {
                    message: job.error,
                    timestamp: job.completedAt
                } : null
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/debug/jobs/failed
 * Get all failed jobs with error details
 */
router.get('/jobs/failed', async (req, res, next) => {
    try {
        const failedJobs = await ScrapingJob.find({ status: 'failed' })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        res.json({
            success: true,
            data: failedJobs.map(job => ({
                jobId: job.jobId,
                platform: job.platform,
                searchType: job.searchType,
                searchParams: job.searchParams,
                error: job.error,
                createdAt: job.createdAt,
                failedAt: job.completedAt
            }))
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/debug/test-connection
 * Test MongoDB connection and browser launch
 */
router.get('/test-connection', async (req, res, next) => {
    const results = {
        mongodb: { connected: false, error: null },
        puppeteer: { canLaunch: false, error: null }
    };

    // Test MongoDB
    try {
        const mongoose = require('mongoose');
        results.mongodb.connected = mongoose.connection.readyState === 1;
        results.mongodb.database = mongoose.connection.name;
    } catch (error) {
        results.mongodb.error = error.message;
    }

    // Test Puppeteer
    try {
        const puppeteer = require('puppeteer');
        const fs = require('fs');
        const { execSync } = require('child_process');

        let launchOptions = {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            protocolTimeout: 180000
        };

        // Try to find a system-installed Chrome/Chromium on macOS
        const possiblePaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/usr/local/bin/chromium-browser',
            '/opt/homebrew/bin/chromium'
        ];

        let executablePath = null;
        for (const path of possiblePaths) {
            if (fs.existsSync(path)) {
                executablePath = path;
                break;
            }
        }

        // Try using which command to find chromium
        if (!executablePath) {
            try {
                const chromiumPath = execSync('which chromium-browser 2>/dev/null || which chromium', {
                    encoding: 'utf-8',
                    stdio: 'pipe'
                }).trim();
                if (chromiumPath) {
                    executablePath = chromiumPath;
                }
            } catch (e) {
                // ignore
            }
        }

        if (executablePath) {
            launchOptions.executablePath = executablePath;
        }

        const browser = await puppeteer.launch(launchOptions);
        await browser.close();
        results.puppeteer.canLaunch = true;
    } catch (error) {
        results.puppeteer.error = error.message;
    }

    res.json({
        success: true,
        data: results
    });
});

/**
 * POST /api/debug/clear-failed-jobs
 * Clear all failed jobs
 */
router.post('/clear-failed-jobs', async (req, res, next) => {
    try {
        const result = await ScrapingJob.deleteMany({ status: 'failed' });

        res.json({
            success: true,
            data: {
                deletedCount: result.deletedCount
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;