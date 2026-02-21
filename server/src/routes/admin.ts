import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All admin routes require SUPERADMIN or ADMIN role
const adminOnly = [authenticate, authorize(['SUPERADMIN', 'ADMIN'])];

// Config — read is admin-only to protect business rules from leaking
router.get('/config', ...adminOnly, AdminController.getConfig);
router.post('/config', ...adminOnly, AdminController.updateConfig);

// KPIs — admin-only
router.get('/kpis', ...adminOnly, AdminController.getKpis);

// Users
router.get('/users', ...adminOnly, AdminController.getUsers);
router.get('/users/:id', ...adminOnly, AdminController.getUser);
router.post('/users', ...adminOnly, AdminController.createUser);
router.post('/users/:id/reset-password', ...adminOnly, AdminController.resetUserPassword);
router.delete('/users/:id', ...adminOnly, AdminController.deleteUser);

// Orders
router.get('/orders', ...adminOnly, AdminController.getOrders);

// Distributors
router.get('/distributors', ...adminOnly, AdminController.getDistributors);
router.post('/distributors', ...adminOnly, AdminController.createDistributor);
router.post('/distributors/:id/reset-password', ...adminOnly, AdminController.resetDistributorPassword);

// Audit Logs
router.get('/audit-logs', ...adminOnly, AdminController.getAuditLogs);

// Referral Analytics
router.get('/referral-analytics', ...adminOnly, AdminController.getReferralAnalytics);

// Plans — read is admin-only
router.get('/plans', ...adminOnly, AdminController.getPlans);
router.post('/plans', ...adminOnly, AdminController.upsertPlan);
router.delete('/plans/:id', ...adminOnly, AdminController.deletePlan);
router.patch('/plans/:id/toggle', ...adminOnly, AdminController.togglePlan);

export default router;
