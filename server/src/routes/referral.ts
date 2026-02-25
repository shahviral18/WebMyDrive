import { Router } from 'express';
import { ReferralController } from '../controllers/ReferralController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticate, ReferralController.getDashboard);
router.get('/history', authenticate, ReferralController.getHistory);
router.get('/my-orders', authenticate, ReferralController.getMyOrders);
router.post('/validate-code', ReferralController.validatePromoCode);
router.get('/resolve', ReferralController.resolveReferral);
router.post('/create-checkout', authenticate, ReferralController.createCheckoutSession);
router.post('/verify-payment', authenticate, ReferralController.verifyPayment);
router.post('/process-purchase', authenticate, ReferralController.processPurchase);

export default router;
