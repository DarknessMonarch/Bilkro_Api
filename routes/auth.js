const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { 
  protect, 
  authenticateAdmin,
} = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/verify-email', authController.verifyEmail);
router.post('/reset-password-request', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);
router.post('/contact', authController.submitContactForm);

router.use(protect);
router.post('/logout', authController.logout);
router.patch('/update-profile', authController.updateProfile);
router.patch('/update-password', authController.updatePassword);
router.patch('/update-profile-image', authController.updateProfileImage);
router.delete('/delete-account', authController.deleteAccount);

router.use('/admin', authenticateAdmin);
router.post('/admin/toggle', authController.toggleAdmin);
router.get('/admin/users', authController.getAllUsers);
router.get('/admin/users/by-role', authController.getUsersByRole);
router.delete('/admin/delete-account/:userId', authController.deleteAccount);
router.post('/admin/bulk-delete', authController.bulkDeleteAccounts);

module.exports = router;