import { Router } from 'express';
import { DistributorController } from '../controllers/DistributorController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/onboard', authenticate, DistributorController.onboard);
router.get('/dashboard', authenticate, DistributorController.getDashboard);
router.get('/history', authenticate, DistributorController.getHistory);
router.post('/qa-sale', authenticate, DistributorController.simulateSale); // Admin or QA
router.post('/request-payout', authenticate, DistributorController.requestPayout);
router.get('/payouts', authenticate, DistributorController.getPayouts);
router.get('/wallet', authenticate, DistributorController.getWallet);
router.get('/customers', authenticate, DistributorController.getCustomers);
router.get('/earnings', authenticate, DistributorController.getEarningsStats);

export default router;
