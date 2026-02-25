import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/google-login", AuthController.googleLogin);
router.post("/temp-login", AuthController.tempLogin);
router.get("/me", authenticate, AuthController.me);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/change-password", authenticate, AuthController.changePassword);
router.post("/setup-workspace-password", authenticate, AuthController.setupWorkspacePassword);

export default router;
