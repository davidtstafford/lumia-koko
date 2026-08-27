import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'lumia-koko.db');

    db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
    });

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
