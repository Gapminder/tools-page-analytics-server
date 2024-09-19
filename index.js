import Koa from "koa";
import Router from "koa-router";
import compress from "koa-compress";
import {init} from "./database.js";
import initRoutes from "./api.js";
import Log from "./logger.js";


Log.time("spinup time");



const port = process.env.PORT || 5555;

Log.info("Starting tools-page-analytics-server on PORT " + port);

const app = new Koa();
const api = new Router(); // routes for the main API

const db = init();
initRoutes(api);

app.use(compress());
app.use(api.routes());

const server = app.listen(port);

Log.timeEnd("spinup time");

export { app, server };