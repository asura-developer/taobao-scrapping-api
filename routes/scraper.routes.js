const express = require('express');
const router = express.Router();
const scraperService = require('../services/scraper.service');
const ScrapingJob = require('../models/ScrapingJob.model');

/**
 * POST /api/scraper/search
 * Start a scraping job by keyword or category name
 * Both keyword and categoryName are treated the same way
 *
 * Examples:
 * - { platform: 'taobao', keyword: '电脑', maxProducts: 100 }
 * - { platform: 'taobao', keyword: '手机', maxProducts: 100 }
 * - { platform: 'taobao', categoryName: '电脑', maxProducts: 100 } // Same as keyword
 */
router.post('/search', async (req, res, next) => {
    try {
        const { platform, keyword, categoryName, maxProducts, maxPages } = req.body;

        if (!platform) {
            return res.status(400).json({
                success: false,
                error: 'Platform is required'
            });
        }

        if (!['taobao', 'tmall', '1688'].includes(platform)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid platform. Must be: taobao, tmall, or 1688'
            });
        }

        // Use keyword first, fallback to categoryName (they're the same thing)
        const searchQuery = keyword || categoryName;

        if (!searchQuery) {
            return res.status(400).json({
                success: false,
                error: 'Either keyword or categoryName is required'
            });
        }

        // All searches now use keyword-based approach (simplified)
        const searchParams = {
            platform,
            keyword: searchQuery,
            searchType: 'keyword',
            maxProducts: maxProducts || 100,
            maxPages: maxPages || 10
        };

        const result = await scraperService.startJob(searchParams);

        res.json({
            success: true,
            data: result,
            message: 'Scraping job started'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/scraper/jobs
 * Get all jobs with optional status filter
 */
router.get('/jobs', async (req, res, next) => {
    try {
        const { status, limit = 50 } = req.query;

        const filter = {};
        if (status) filter.status = status;

        const jobs = await ScrapingJob.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({
            success: true,
            data: jobs
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/scraper/job/:jobId
 * Get job status
 */
router.get('/job/:jobId', async (req, res, next) => {
    try {
        const job = await scraperService.getJobStatus(req.params.jobId);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        res.json({
            success: true,
            data: job
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/scraper/job/:jobId
 * Cancel a running job
 */
router.delete('/job/:jobId', async (req, res, next) => {
    try {
        const result = await scraperService.cancelJob(req.params.jobId);

        res.json({
            success: true,
            data: result,
            message: 'Job cancelled'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/scraper/details/:itemId
 * Scrape product details for a specific product
 */
router.post('/details/:itemId', async (req, res, next) => {
    try {
        const product = await scraperService.scrapeProductDetails(req.params.itemId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: product,
            message: 'Product details scraped successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/scraper/batch-details
 * Scrape details for multiple products
 */
router.post('/batch-details', async (req, res, next) => {
    try {
        const { itemIds } = req.body;

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'itemIds array is required'
            });
        }

        // Start batch job
        const jobId = await scraperService.startBatchDetailScraping(itemIds);

        res.json({
            success: true,
            data: { jobId },
            message: `Batch detail scraping started for ${itemIds.length} products`
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;