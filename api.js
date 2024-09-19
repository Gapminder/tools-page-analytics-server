
import { recordToCache, retrieveAllFromCache, retrieveFromDb, erase, getCount, saveToDb} from "./database.js";
import { getHeapStatistics } from 'v8';


import Log from "./logger.js"
const liveSince = (new Date()).valueOf();

export default function initRoutes(api) {

  // Endpoint to write an event
  //curl -X POST http://localhost:5555/record -H "Content-Type: application/json" -d '{"concept": "pop", "space": "geo,age,time", "tool": "bubblechart", "dataset": "population", "type": "url", "referer": "test"}'
  api.get('/record', (ctx) => {
    const { concept, space, tool, dataset, type, referer} = ctx.query;
    if (!concept || !space || !tool || !dataset || !type || !referer) {
        ctx.status = 400;
        ctx.body = { message: `Bad request body: ${!concept?"concept="+concept:""} ${!space?"space="+space:""} ${!tool?"tool="+tool:""} ${!dataset?"dataset="+dataset:""} ${!type?"type="+type:""} ${!referer?"referer="+referer:""}` }
        return;
    }

    recordToCache({ concept, space, tool, dataset, type, referer})

    ctx.status = 200;
    ctx.body = { message: 'Event added successfully' };
  });


  // Endpoint to read events with optional filters
  api.get('/read', async (ctx) => {
    if (ctx.query && Object.keys(ctx.query).length) {
      const events = await retrieveFromDb(ctx.query);
      ctx.body = { events };
    } else {
      ctx.body = { events: retrieveAllFromCache() };
    }
    ctx.status = 200;
  });

  api.get('/erase', async (ctx) => {
    await erase();
    ctx.status = 200;
  });


  api.get('/save', async (ctx) => {
    await saveToDb();
    ctx.status = 200;
  });

  api.get('/status', async (ctx) => {
    const {heapTotal, heapUsed} = process.memoryUsage();
    const {heap_size_limit} = getHeapStatistics();
    const toMB = (b) => Math.round(b/1024/1024);
    const memory = {
      limit_MB: toMB(heap_size_limit),
      heapTotal_MB: toMB(heapTotal),
      heapUsed_MB: toMB(heapUsed),
      heapTotal_PCT:Math.round(heapTotal/heap_size_limit * 100),
      heapUsed_PCT: Math.round(heapUsed/heap_size_limit * 100)
    }
    const count = await getCount();
    ctx.status = 200; 
      ctx.body = JSON.stringify({
        name: "tools-page-analytics-server",
        uptime_ms: (new Date()).valueOf() - liveSince,
        liveSince,
        memory,
        appVersion: process.env.npm_package_version,
        count
      });
  });

  
  return api;
}
