const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    type: String, // e.g., "Size", "Color"
    options: [String]
}, { _id: false });

const detailedInfoSchema = new mongoose.Schema({
    fullDescription: String,
    specifications: mongoose.Schema.Types.Mixed,
    brand: String,
    additionalImages: [String],
    reviewsCount: String,
    rating: String,
    inStock: Boolean,
    shippingInfo: String,
    variants: [variantSchema],
    salesVolume: String,
}, { _id: false });

const productSchema = new mongoose.Schema({
    itemId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    price: String,
    image: String,
    link: { type: String, required: true },

    // Search metadata
    searchKeyword: String,
    categoryId: String,
    categoryName: String,
    pageNumber: Number,

    // Platform identification
    platform: {
        type: String,
        enum: ['taobao', 'tmall', '1688'],
        required: true,
        index: true
    },

    // Detailed information
    detailedInfo: detailedInfoSchema,
    detailsScraped: { type: Boolean, default: false },
    detailsScrapedAt: Date,

    // Timestamps
    extractedAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

    // Migration tracking
    migrationVersion: { type: Number, default: 1 },
    migrationHistory: [{
        version: Number,
        migratedAt: Date,
        changes: mongoose.Schema.Types.Mixed
    }]
}, {
    timestamps: true,
    collection: 'products'
});

// Indexes for efficient querying
productSchema.index({ platform: 1, categoryId: 1 });
productSchema.index({ searchKeyword: 1, platform: 1 });
productSchema.index({ detailsScraped: 1 });
productSchema.index({ createdAt: -1 });

// Text search index
productSchema.index({ title: 'text', 'detailedInfo.fullDescription': 'text' });

module.exports = mongoose.model('Product', productSchema);