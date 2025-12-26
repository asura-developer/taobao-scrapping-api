const express = require('express');
const router = express.Router();
const Product = require('../models/Product.model');

/**
 * GET /api/products
 * Get all products with filtering and pagination
 */
router.get('/', async (req, res, next) => {
    try {
        const {
            platform,
            category,
            keyword,
            detailsScraped,
            page = 1,
            limit = 50,
            sort = '-createdAt'
        } = req.query;

        const filter = {};
        if (platform) filter.platform = platform;
        if (category) filter.categoryId = category;
        if (keyword) filter.searchKeyword = new RegExp(keyword, 'i');
        if (detailsScraped !== undefined) filter.detailsScraped = detailsScraped === 'true';

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort(sort)
                .limit(parseInt(limit))
                .skip(skip)
                .lean(),
            Product.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: {
                products,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/products/:itemId
 * Get a single product by itemId
 */
router.get('/:itemId', async (req, res, next) => {
    try {
        const product = await Product.findOne({ itemId: req.params.itemId });

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/products/search/text
 * Full-text search on products
 */
router.get('/search/text', async (req, res, next) => {
    try {
        const { q, page = 1, limit = 20 } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query (q) is required'
            });
        }

        const skip = (page - 1) * limit;

        const products = await Product.find(
            { $text: { $search: q } },
            { score: { $meta: 'textScore' } }
        )
            .sort({ score: { $meta: 'textScore' } })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        res.json({
            success: true,
            data: { products, count: products.length }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/products/stats/summary
 * Get statistics summary
 */
router.get('/stats/summary', async (req, res, next) => {
    try {
        const [totalProducts, byPlatform, byCategory, withDetails] = await Promise.all([
            Product.countDocuments({}),
            Product.aggregate([
                { $group: { _id: '$platform', count: { $sum: 1 } } }
            ]),
            Product.aggregate([
                { $group: { _id: '$categoryName', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            Product.countDocuments({ detailsScraped: true })
        ]);

        res.json({
            success: true,
            data: {
                totalProducts,
                productsWithDetails: withDetails,
                detailsPercentage: ((withDetails / totalProducts) * 100).toFixed(2),
                byPlatform,
                topCategories: byCategory
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/products/:itemId
 * Delete a product
 */
router.delete('/:itemId', async (req, res, next) => {
    try {
        const result = await Product.deleteOne({ itemId: req.params.itemId });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;