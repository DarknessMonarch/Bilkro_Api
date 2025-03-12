const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect, admin } = require('../middleware/authMiddleware');

// Get sales reports
router.get('/sales', protect, reportController.getSalesReports);

// Get product reports
router.get('/products', protect, admin, reportController.getProductReports);

// Get category reports
router.get('/categories', protect, admin, reportController.getCategoryReports);

// Get payment method reports
router.get('/payments', protect, admin, reportController.getPaymentMethodReports);

// Get detailed report for a specific sale
router.get('/sales/:saleId', protect, admin, reportController.getSaleReport);

// Export sales reports as CSV
router.get('/sales/export', protect, admin, reportController.exportSalesReports);

// Get inventory valuation report
router.get('/inventory', protect, admin, reportController.getInventoryValuationReport);

module.exports = router;
