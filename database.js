// Importing the crypto module with ES6 syntax
import crypto from 'crypto';
import { promisify } from 'util';
import Log from "./logger.js";
import {existsSync, mkdirSync} from 'fs';
import sqlite3 from 'sqlite3';
import path from 'path';
import cron from 'node-cron';

sqlite3.verbose();
let requestMap = new Map();
let db = null;

// Function to create an MD5 hash
function createMD5Hash(input) {
    const hash = crypto.createHash('md5');
    hash.update(input);
    return hash.digest('hex');
}

function key({concept="", space="", tool="", dataset="", type="", referer=""} = {}){
    return createMD5Hash(`${concept} ${space} ${tool} ${dataset} ${referer} ${type}`);
}


const dbFilePath = path.resolve("./database/");

function ensurePathExists(){
  if (!existsSync(dbFilePath)) mkdirSync(dbFilePath, { recursive: true });
}

export function init({filename = "events.db"} = {}){
  // Path to the SQLite database file
  ensurePathExists();

  // Initialize SQLite database
  return db = new sqlite3.Database(path.resolve(dbFilePath, filename), (err) => {
    if (err) {
        Log.error('Error opening database:', err.message);
    } else {
        // Create the table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                concept TEXT,
                space TEXT,
                tool TEXT,
                dataset TEXT,
                type TEXT,
                referer TEXT,
                count INTEGER,
                date DATE DEFAULT CURRENT_DATE
            )
        `);
        Log.info('Connected to SQLite database.');
    }
  });
}


export async function getCount(){
  // Promisify db.get() function
  const getAsync = promisify(db.get).bind(db);
  try {
      const row = await getAsync("SELECT COUNT(*) as count FROM events");
      console.log(`Number of rows in the events table: ${row.count}`);
      
      return {eventsInDb: row.count, eventsInCache: requestMap.size};
  } catch (err) {
      console.error("Error counting rows:", err.message);
  }
}

export function recordToCache(params = {}){

    const k = key(params);
    const now = new Date();
    const now_ms = now.valueOf();
    const record = requestMap.get(k);
    
    if(!record) {
        requestMap.set(k, {...params, count: 1, time: [now_ms]});
        return 1;
    } else {
        record.count = record.count + 1;
        record.time.push(now_ms);
        return record.count;
    }
}

export function retrieveAllFromCache(){
  return [...requestMap.values()];
}

export function retrieveOneFromCache(params){
  return requestMap.get(key(params));
}

export async function retrieveFromDb({concept, space, tool, dataset, type, referer, from_count, to_count, from_date, to_date} = {}){

  let query = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  
  if (concept) { query += ' AND concept = ?'; params.push(concept);}
  if (space) { query += ' AND space = ?'; params.push(space);}
  if (tool) { query += ' AND tool = ?'; params.push(tool);}
  if (dataset) { query += ' AND dataset = ?'; params.push(dataset);}
  if (type) { query += ' AND type = ?'; params.push(type);}
  if (referer) { query += ' AND referer = ?'; params.push(referer);}
  if (dataset) { query += ' AND dataset = ?'; params.push(dataset);}
  if (from_date) { query += ' AND date >= ?'; params.push(from_date);}
  if (to_date) { query += ' AND date <= ?'; params.push(to_date);}
  if (from_count) { query += ' AND count >= ?'; params.push(from_count);}
  if (to_count) { query += ' AND count <= ?'; params.push(to_count);}

  return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
          if (err) {
              reject(err);
          } else {
              resolve(rows);
          }
      });
  });
}

export function saveToDb() {
  const events = [...requestMap.values()];

  // Start the transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare('INSERT INTO events (concept, space, tool, dataset, type, referer, count) VALUES (?, ?, ?, ?, ?, ?, ?)');
    
    // Insert each event in the array
    events.forEach(({concept, space, tool, dataset, type, referer, count}) => {
        stmt.run(concept, space, tool, dataset, type, referer, count);
    });

    // Finalize the prepared statement and commit the transaction
    stmt.finalize();
    db.run('COMMIT');
    requestMap = new Map();
  });

}


export function erase() {
  return new Promise((resolve, reject) => {
    requestMap = new Map();
    db.run("DELETE FROM events", function(err) {
      if (err) {
        Log.error(err.message)
        reject(err);
      } else {
        Log.info(`All rows deleted from the events table`);
        resolve()
      }
    });
  })

}

// Every hour at minute 0
//cron.schedule('0 * * * *', () => backupEvents());

// Every day at 23:59
cron.schedule('59 23 * * *', () => saveToDb());


process.on('SIGINT', () => {
  db.close(() => {
      Log.info('Database connection closed.');
      process.exit(0);
  });
});

process.on('SIGTERM', () => {
  db.close(() => {
      Log.info('Database connection closed.');
      process.exit(0);
  });
});