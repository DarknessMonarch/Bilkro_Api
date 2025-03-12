const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const reportController = require('../controllers/report');


// Get sales reports
router.get('/sales', auth.protect, reportController.getSalesReports);

// Get product reports
router.get('/products',  auth.protect, reportController.getProductReports);

// Get category reports
router.get('/categories',  auth.protect, reportController.getCategoryReports);

// Get payment method reports
router.get('/payment-methods',  auth.protect, reportController.getPaymentMethodReports);

// Get inventory valuation report
router.get('/inventory-valuation',  auth.protect, reportController.getInventoryValuation);

// Export reports
router.get('/export',  auth.protect, reportController.exportSalesReports);

// Get dashboard data
router.get('/dashboard',  auth.protect, reportController.getDashboardData);

module.exports = router;