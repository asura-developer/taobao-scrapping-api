const express = require('express');
const router = express.Router();
const migrationService = require('../services/migration.service');

/**
 * GET /api/migration/version
 * Get current migration version
 */
router.get('/version', async (req, res, next) => {
    try {
        const version = await migrationService.getCurrentVersion();

        res.json({
            success: true,
            data: { currentVersion: version }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/migration/run
 * Run migrations
 */
router.post('/run', async (req, res, next) => {
    try {
        const { targetVersion } = req.body;
        const result = await migrationService.runMigrations(targetVersion);

        res.json({
            success: result.success,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/migration/rollback
 * Rollback migrations
 */
router.post('/rollback', async (req, res, next) => {
    try {
        const { targetVersion } = req.body;

        if (!targetVersion) {
            return res.status(400).json({
                success: false,
                error: 'targetVersion is required'
            });
        }

        const result = await migrationService.rollback(targetVersion);

        res.json({
            success: result.success,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/migration/cleanup-duplicates
 * Remove duplicate products
 */
router.post('/cleanup-duplicates', async (req, res, next) => {
    try {
        const result = await migrationService.cleanupDuplicates();

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/migration/fix-missing-data
 * Fix products with missing data
 */
router.post('/fix-missing-data', async (req, res, next) => {
    try {
        const result = await migrationService.fixMissingData();

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/migration/validate
 * Validate data integrity
 */
router.get('/validate', async (req, res, next) => {
    try {
        const result = await migrationService.validateData();

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;