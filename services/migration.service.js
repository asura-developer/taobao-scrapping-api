const Product = require('../models/Product.model');

class MigrationService {
    constructor() {
        this.migrations = [
            {
                version: 2,
                name: 'add_platform_field',
                description: 'Adds platform field to existing products',
                up: this.migrationV2Up.bind(this),
                down: this.migrationV2Down.bind(this)
            },
            {
                version: 3,
                name: 'normalize_variants',
                description: 'Normalizes variant structure to array format',
                up: this.migrationV3Up.bind(this),
                down: this.migrationV3Down.bind(this)
            },
            {
                version: 4,
                name: 'add_category_name',
                description: 'Adds categoryName field from categoryId mapping',
                up: this.migrationV4Up.bind(this),
                down: this.migrationV4Down.bind(this)
            }
        ];
    }

    async getCurrentVersion() {
        const product = await Product.findOne().sort({ migrationVersion: -1 });
        return product?.migrationVersion || 1;
    }

    async runMigrations(targetVersion = null) {
        const currentVersion = await getCurrentVersion();
        const target = targetVersion || Math.max(...this.migrations.map(m => m.version));

        const migrationsToRun = this.migrations
            .filter(m => m.version > currentVersion && m.version <= target)
            .sort((a, b) => a.version - b.version);

        const results = {
            success: true,
            migrationsRun: [],
            errors: []
        };

        for (const migration of migrationsToRun) {
            try {
                console.log(`Running migration: ${migration.name} (v${migration.version})`);
                const result = await migration.up();
                results.migrationsRun.push({
                    version: migration.version,
                    name: migration.name,
                    result
                });
            } catch (error) {
                results.success = false;
                results.errors.push({
                    version: migration.version,
                    name: migration.name,
                    error: error.message
                });
                break; // Stop on first error
            }
        }

        return results;
    }

    async rollback(targetVersion) {
        const currentVersion = await this.getCurrentVersion();

        const migrationsToRollback = this.migrations
            .filter(m => m.version <= currentVersion && m.version > targetVersion)
            .sort((a, b) => b.version - a.version);

        const results = {
            success: true,
            migrationsRolledBack: [],
            errors: []
        };

        for (const migration of migrationsToRollback) {
            try {
                console.log(`Rolling back: ${migration.name} (v${migration.version})`);
                const result = await migration.down();
                results.migrationsRolledBack.push({
                    version: migration.version,
                    name: migration.name,
                    result
                });
            } catch (error) {
                results.success = false;
                results.errors.push({
                    version: migration.version,
                    name: migration.name,
                    error: error.message
                });
                break;
            }
        }

        return results;
    }

    // Migration V2: Add platform field
    async migrationV2Up() {
        const products = await Product.find({ platform: { $exists: false } });
        let updated = 0;

        for (const product of products) {
            // Infer platform from link
            let platform = 'taobao';
            if (product.link.includes('tmall.com')) {
                platform = 'tmall';
            } else if (product.link.includes('1688.com')) {
                platform = '1688';
            }

            product.platform = platform;
            product.migrationVersion = 2;
            product.migrationHistory.push({
                version: 2,
                migratedAt: new Date(),
                changes: { addedPlatform: platform }
            });

            await product.save();
            updated++;
        }

        return { updated, message: `Added platform field to ${updated} products` };
    }

    async migrationV2Down() {
        await Product.updateMany(
            { migrationVersion: { $gte: 2 } },
            {
                $unset: { platform: '' },
                $set: { migrationVersion: 1 }
            }
        );
        return { message: 'Removed platform field' };
    }

    // Migration V3: Normalize variants to array structure
    async migrationV3Up() {
        const products = await Product.find({
            'detailedInfo.variants': { $exists: true, $type: 'object' }
        });

        let updated = 0;

        for (const product of products) {
            const oldVariants = product.detailedInfo.variants;

            // Check if already in array format
            if (Array.isArray(oldVariants)) continue;

            // Convert object to array
            const variantsArray = Object.entries(oldVariants).map(([type, options]) => ({
                type,
                options: Array.isArray(options) ? options : [options]
            }));

            product.detailedInfo.variants = variantsArray;
            product.migrationVersion = 3;
            product.migrationHistory.push({
                version: 3,
                migratedAt: new Date(),
                changes: {
                    normalizedVariants: true,
                    variantCount: variantsArray.length
                }
            });

            await product.save();
            updated++;
        }

        return { updated, message: `Normalized variants for ${updated} products` };
    }

    async migrationV3Down() {
        const products = await Product.find({ migrationVersion: { $gte: 3 } });

        for (const product of products) {
            if (Array.isArray(product.detailedInfo?.variants)) {
                const variantsObject = {};
                product.detailedInfo.variants.forEach(v => {
                    variantsObject[v.type] = v.options;
                });
                product.detailedInfo.variants = variantsObject;
                product.migrationVersion = 2;
                await product.save();
            }
        }

        return { message: 'Reverted variants to object format' };
    }

    // Migration V4: Add category names
    async migrationV4Up() {
        // Category ID to name mapping (example - expand as needed)
        const categoryMapping = {
            '50014866': 'Baby Formula',
            '50025969': 'Beauty & Skincare',
            '50010404': 'Home & Living',
            '50010788': 'Shoes & Bags',
            '50014811': 'Electronics',
            '50016348': 'Sports & Outdoor'
        };

        const products = await Product.find({
            categoryId: { $exists: true },
            categoryName: { $exists: false }
        });

        let updated = 0;

        for (const product of products) {
            const categoryName = categoryMapping[product.categoryId] || 'Unknown';

            product.categoryName = categoryName;
            product.migrationVersion = 4;
            product.migrationHistory.push({
                version: 4,
                migratedAt: new Date(),
                changes: { addedCategoryName: categoryName }
            });

            await product.save();
            updated++;
        }

        return { updated, message: `Added category names to ${updated} products` };
    }

    async migrationV4Down() {
        await Product.updateMany(
            { migrationVersion: { $gte: 4 } },
            {
                $unset: { categoryName: '' },
                $set: { migrationVersion: 3 }
            }
        );
        return { message: 'Removed category names' };
    }

    // Utility: Bulk data cleanup
    async cleanupDuplicates() {
        const duplicates = await Product.aggregate([
            {
                $group: {
                    _id: '$itemId',
                    count: { $sum: 1 },
                    docs: { $push: '$_id' }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        let removed = 0;
        for (const dup of duplicates) {
            // Keep the first, remove the rest
            const toRemove = dup.docs.slice(1);
            await Product.deleteMany({ _id: { $in: toRemove } });
            removed += toRemove.length;
        }

        return { removed, message: `Removed ${removed} duplicate products` };
    }

    // Utility: Fix missing data
    async fixMissingData() {
        let fixed = 0;

        // Fix products without platform
        const noPlatform = await Product.find({ platform: { $exists: false } });
        for (const product of noPlatform) {
            if (product.link.includes('tmall')) product.platform = 'tmall';
            else if (product.link.includes('1688')) product.platform = '1688';
            else product.platform = 'taobao';
            await product.save();
            fixed++;
        }

        // Fix products with invalid prices
        const invalidPrice = await Product.find({
            $or: [
                { price: null },
                { price: '' },
                { price: 'N/A' }
            ]
        });

        for (const product of invalidPrice) {
            // Try to extract price from link or mark for re-scraping
            product.price = '0.00';
            await product.save();
            fixed++;
        }

        return { fixed, message: `Fixed ${fixed} products with missing data` };
    }

    // Data validation
    async validateData() {
        const issues = {
            missingPlatform: 0,
            missingPrice: 0,
            missingTitle: 0,
            invalidLinks: 0,
            total: 0
        };

        const products = await Product.find({});

        for (const product of products) {
            if (!product.platform) issues.missingPlatform++;
            if (!product.price || product.price === '0.00') issues.missingPrice++;
            if (!product.title || product.title.length < 3) issues.missingTitle++;
            if (!product.link || !product.link.startsWith('http')) issues.invalidLinks++;
        }

        issues.total = await Product.countDocuments({});

        return issues;
    }
}

module.exports = new MigrationService();