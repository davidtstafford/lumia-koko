// API Server - Always running, independent of OBS
// Provides HTTP endpoints for remote control (e.g., Stream Deck integration)

import express, { Express } from 'express';
import { Server } from 'http';
import { DatabaseService } from '../database/service';
import { EventEmitter } from 'events';

export class ApiServer extends EventEmitter {
  private app: Express;
  private server: Server | null = null;
  private port: number = 8766;

  constructor() {
    super();
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', port: this.port });
    });

    // Toggle TTS endpoint
    this.app.post('/toggle-tts', (_req, res) => {
      try {
        const currentValue = DatabaseService.getSetting('tts_enabled');
        const newState = currentValue !== 'true';
        DatabaseService.setSetting('tts_enabled', newState ? 'true' : 'false');
        
        // Emit event to notify renderer
        this.emit('tts-toggled', newState);
        
        res.json({ 
          success: true, 
          ttsEnabled: newState,
          message: newState ? 'TTS enabled' : 'TTS disabled'
        });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  async start(): Promise<void> {
    if (this.server) {
      console.log('API server already running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`API server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (err) => {
        console.error('API server error:', err);
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        console.log('API server stopped');
        this.server = null;
        resolve();
      });
    });
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getPort(): number {
    return this.port;
  }

  getURL(): string {
    return `http://localhost:${this.port}`;
  }
}

let apiServerInstance: ApiServer | null = null;

export function getApiServer(): ApiServer {
  if (!apiServerInstance) {
    apiServerInstance = new ApiServer();
  }
  return apiServerInstance;
}
