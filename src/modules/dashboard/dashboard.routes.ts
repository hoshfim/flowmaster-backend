import { Hono } from "hono";
import { dashboardController } from "./dashboard.controller.js";
 
export const dashboardRoutes = new Hono();
 
dashboardRoutes.get("/summary", dashboardController.getSummary);
dashboardRoutes.get("/events",  dashboardController.getEvents);
 