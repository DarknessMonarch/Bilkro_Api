const express = require('express');
const router = express.Router();
const debtController = require('../controllers/debt');
const { protect, authenticateAdmin } = require('../middleware/auth');

// Basic protection for all routes
router.use(protect);

router.get('/user', debtController.getUserDebts);
router.get('/user/:debtId', debtController.getDebtById);
router.post('/user/:debtId/pay', debtController.makePayment);

router.get('/statistics', authenticateAdmin, debtController.getDebtStatistics);

router.use(authenticateAdmin); 
router.get('/admin', debtController.getAllDebts);
router.get('/admin/overdue', debtController.getOverdueDebtsReport);
router.put('/admin/:debtId', debtController.updateDebt);
router.post('/admin/:debtId/remind', debtController.sendReminder);

module.exports = router;