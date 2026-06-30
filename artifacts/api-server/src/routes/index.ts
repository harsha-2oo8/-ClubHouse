import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import collegesRouter from "./colleges";
import projectsRouter from "./projects";
import eventsRouter from "./events";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/colleges", collegesRouter);
router.use("/projects", projectsRouter);
router.use("/events", eventsRouter);
router.use("/notifications", notificationsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/admin", adminRouter);

export default router;
