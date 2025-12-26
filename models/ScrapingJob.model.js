const mongoose = require('mongoose');

const scrapingJobSchema = new mongoose.Schema({
    jobId: { type: String, unique: true, required: true },
    platform: {
        type: String,
        enum: ['taobao', 'tmall', '1688'],
        required: true
    },
    searchType: {
        type: String,
        enum: ['keyword', 'category'],
        required: true
    },
    searchParams: {
        keyword: String,
        categoryId: String,
        categoryName: String,
        maxProducts: Number,
        maxPages: Number
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    progress: {
        currentPage: { type: Number, default: 0 },
        totalPages: { type: Number, default: 0 },
        productsScraped: { type: Number, default: 0 },
        detailsScraped: { type: Number, default: 0 }
    },
    results: {
        totalProducts: { type: Number, default: 0 },
        successfulDetails: { type: Number, default: 0 },
        failedDetails: { type: Number, default: 0 }
    },
    error: String,
    startedAt: Date,
    completedAt: Date,
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

scrapingJobSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ScrapingJob', scrapingJobSchema);