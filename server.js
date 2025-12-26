// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const scraperRoutes = require('./routes/scraper.routes');
const productRoutes = require('./routes/product.routes');
const migrationRoutes = require('./routes/migration.routes');
const debugRoutes = require('./routes/debug.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// Serve index.html on root path
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || '')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api/scraper', scraperRoutes);
app.use('/api/products', productRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/debug', debugRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 Taobao Scraper API running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`🐛 Debug endpoint: http://localhost:${PORT}/api/debug/test-connection`);
    console.log(`${'='.repeat(50)}\n`);
});


module.exports = app;