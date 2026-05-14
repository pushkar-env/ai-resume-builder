import { Router, type IRouter } from "express";
import healthRouter from "./health";
import resumesRouter from "./resumes";
import templatesRouter from "./templates";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import paymentsRouter from "./payments";
import contactRouter from "./contact";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactRouter);
router.use(resumesRouter);
router.use(templatesRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(paymentsRouter);

export default router;
