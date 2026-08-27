import express from 'express';
import { Server as WebSocketServer } from 'ws';
import * as http from 'http';
import * as path from 'path';
import { DatabaseService } from '../database/service';
import { EventEmitter } from 'events';

export class OBSServer extends EventEmitter {
  private app: express.Application;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private port: number;

  constructor(port: number = 8765) {
    super();
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Serve static HTML for OBS browser source
    this.app.get('/tts-overlay', (_req, res) => {
      const html = this.getOverlayHTML();
      res.send(html);
    });

    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', port: this.port });
    });
  }


  private getOverlayHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TTS Overlay</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: transparent;
      overflow: hidden;
    }

    #tts-container {
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 400px;
      overflow: hidden;
    }

    .tts-message {
      background: rgba(20, 20, 20, 0.95);
      border-left: 4px solid #9147ff;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.3s ease-out;
      opacity: 0;
      animation-fill-mode: forwards;
    }

    .tts-message.speaking {
      border-left-color: #00ff00;
      animation: pulse 1s ease-in-out infinite;
    }

    .tts-message.completed {
      opacity: 0.6;
    }

    @keyframes slideIn {
      from {
        transform: translateX(-100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes pulse {
      0%, 100% {
        border-left-color: #00ff00;
      }
      50% {
        border-left-color: #00cc00;
      }
    }

    .tts-username {
      color: #9147ff;
      font-weight: bold;
      font-size: 18px;
      margin-bottom: 5px;
    }

    .tts-text {
      color: #ffffff;
      font-size: 16px;
      line-height: 1.4;
    }

    .tts-status {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(20, 20, 20, 0.9);
      padding: 8px 12px;
      border-radius: 6px;
      color: #ffffff;
      font-size: 12px;
      display: none;
    }

    .tts-status.connected {
      color: #00ff00;
      display: block;
    }

    .tts-status.disconnected {
      color: #ff0000;
      display: block;
    }
  </style>
</head>
<body>
  <div id="tts-status" class="tts-status">Connecting...</div>
  <div id="tts-container"></div>

  <script>
    const container = document.getElementById('tts-container');
    const statusEl = document.getElementById('tts-status');
    let ws = null;
    let reconnectTimeout = null;
    const messages = new Map();
    let currentAudio = null; // Keep reference to prevent garbage collection

    function connect() {
      ws = new WebSocket('ws://localhost:${this.port}/ws');
      
      ws.onopen = () => {
        console.log('Connected to TTS server');
        statusEl.textContent = '🔊 TTS Connected';
        statusEl.className = 'tts-status connected';
        setTimeout(() => {
          statusEl.style.display = 'none';
        }, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleTTSEvent(data);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('Disconnected from TTS server');
        statusEl.textContent = '⚠️ TTS Disconnected';
        statusEl.className = 'tts-status disconnected';
        statusEl.style.display = 'block';
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeout = setTimeout(connect, 3000);
      };
    }

    function handleTTSEvent(data) {
      const { type, item } = data;

      switch (type) {
        case 'start':
          console.log('[OBS Overlay] Received TTS event:', {
            provider: item.provider,
            voiceId: item.voiceId,
            hasAudioUrl: !!item.audioUrl,
            hasAudioData: !!item.audioData,
            audioDataLength: item.audioData?.length || 0
          });
          addMessage(item);
          if (item.audioUrl) {
            // Play audio from cloud provider (AWS/Azure/GCP)
            console.log('[OBS Overlay] Playing from audioUrl');
            playAudioUrl(item.audioUrl);
          } else if (item.audioData) {
            // Play base64 encoded audio
            console.log('[OBS Overlay] Playing from audioData');
            playAudioData(item.audioData);
          } else {
            // Fallback: synthesize using WebSpeech
            console.log('[OBS Overlay] Falling back to WebSpeech');
            speakMessage(item);
          }
          break;
        case 'complete':
          removeMessage(item.id);
          break;
        case 'queue':
          // Optional: Show queue count
          break;
      }
    }

    function playAudioUrl(url) {
      console.log('[OBS Overlay] playAudioUrl called with:', url.substring(0, 100));
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      
      currentAudio = new Audio(url);
      currentAudio.onended = () => {
        console.log('[OBS Overlay] Audio URL playback ended');
        currentAudio = null;
        notifyAudioComplete();
      };
      currentAudio.onerror = (err) => {
        console.error('[OBS Overlay] Audio URL error:', err);
        currentAudio = null;
        notifyAudioComplete();
      };
      currentAudio.play().then(() => {
        console.log('[OBS Overlay] Audio URL play started successfully');
      }).catch(err => {
        console.error('[OBS Overlay] Audio URL play failed:', err);
        currentAudio = null;
        notifyAudioComplete();
      });
    }

    function playAudioData(base64Data) {
      console.log('[OBS Overlay] playAudioData called, data length:', base64Data?.length || 0);
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      
      try {
        currentAudio = new Audio('data:audio/mp3;base64,' + base64Data);
        currentAudio.onended = () => {
          console.log('[OBS Overlay] Audio data playback ended');
          currentAudio = null;
          notifyAudioComplete();
        };
        currentAudio.onerror = (err) => {
          console.error('[OBS Overlay] Audio data error:', err);
          currentAudio = null;
          notifyAudioComplete();
        };
        currentAudio.play().then(() => {
          console.log('[OBS Overlay] Audio data play started successfully');
        }).catch(err => {
          console.error('[OBS Overlay] Audio data play failed:', err);
          currentAudio = null;
          notifyAudioComplete();
        });
      } catch (err) {
        console.error('[OBS Overlay] Failed to create audio from data:', err);
        currentAudio = null;
        notifyAudioComplete();
      }
    }

    function notifyAudioComplete() {
      console.log('[OBS Overlay] Audio complete - sending message to server');
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'audioComplete' }));
        console.log('[OBS Overlay] ✅ Sent audioComplete message to server');
      } else {
        console.error('[OBS Overlay] ⚠️ WebSocket not connected, cannot send audioComplete');
      }
    }

    function speakMessage(item) {
      if (!('speechSynthesis' in window)) {
        console.error('Speech synthesis not supported');
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(item.text);
      
      // Try to find the voice if specified
      if (item.voiceId) {
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.voiceURI === item.voiceId || v.name === item.voiceId);
        if (voice) {
          utterance.voice = voice;
        }
      }

      // Apply voice settings
      utterance.rate = item.speed || 1.0;
      utterance.pitch = item.pitch || 1.0;
      utterance.volume = item.volume || 1.0;

      utterance.onend = () => {
        console.log('Speech complete for:', item.id);
        notifyAudioComplete();
      };

      utterance.onerror = (err) => {
        console.error('Speech error:', err);
        notifyAudioComplete();
      };

      window.speechSynthesis.speak(utterance);
    }

    function addMessage(item) {
      // Remove existing message if present
      if (messages.has(item.id)) {
        removeMessage(item.id);
      }

      const messageEl = document.createElement('div');
      messageEl.className = 'tts-message speaking';
      messageEl.id = \`msg-\${item.id}\`;
      
      const usernameEl = document.createElement('div');
      usernameEl.className = 'tts-username';
      usernameEl.textContent = item.username || 'Unknown';
      
      const textEl = document.createElement('div');
      textEl.className = 'tts-text';
      textEl.textContent = item.text;
      
      messageEl.appendChild(usernameEl);
      messageEl.appendChild(textEl);
      
      container.appendChild(messageEl);
      messages.set(item.id, messageEl);

      // Keep only last 3 messages
      if (messages.size > 3) {
        const firstKey = messages.keys().next().value;
        removeMessage(firstKey);
      }
    }

    function removeMessage(id) {
      const messageEl = messages.get(id);
      if (messageEl) {
        messageEl.classList.remove('speaking');
        messageEl.classList.add('completed');
        
        setTimeout(() => {
          messageEl.style.transition = 'opacity 0.5s, transform 0.5s';
          messageEl.style.opacity = '0';
          messageEl.style.transform = 'translateY(20px)';
          
          setTimeout(() => {
            if (messageEl.parentNode) {
              messageEl.parentNode.removeChild(messageEl);
            }
            messages.delete(id);
          }, 500);
        }, 1000);
      }
    }

    // Connect on load
    connect();

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    });
  </script>
</body>
</html>
    `;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer(this.app);
        
        // Set up WebSocket server
        this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
        
        this.wss.on('connection', (ws) => {
          console.log('OBS overlay connected');
          
          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              if (message.type === 'audioComplete') {
                this.emit('audioComplete');
              }
            } catch (err) {
              console.error('Failed to parse WebSocket message:', err);
            }
          });
          
          ws.on('close', () => {
            console.log('OBS overlay disconnected');
          });
        });

        this.server.listen(this.port, () => {
          console.log(`OBS server running at http://localhost:${this.port}`);
          console.log(`TTS Overlay: http://localhost:${this.port}/tts-overlay`);
          
          // Save port to database
          DatabaseService.setSetting('obs_server_port', this.port.toString());
          DatabaseService.setSetting('obs_server_enabled', 'true');
          
          resolve();
        });

        this.server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`Port ${this.port} is already in use`);
          }
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.clients.forEach((client) => {
          client.close();
        });
        this.wss.close();
      }

      if (this.server) {
        this.server.close(() => {
          console.log('OBS server stopped');
          DatabaseService.setSetting('obs_server_enabled', 'false');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  broadcast(event: { type: string; item?: any }): void {
    if (!this.wss) return;

    const message = JSON.stringify(event);
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    });
  }

  getURL(): string {
    return `http://localhost:${this.port}/tts-overlay`;
  }

  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }
}

let obsServerInstance: OBSServer | null = null;

export function getOBSServer(port?: number): OBSServer {
  if (!obsServerInstance) {
    const savedPort = DatabaseService.getSetting('obs_server_port');
    const serverPort = port || (savedPort ? parseInt(savedPort) : 8765);
    obsServerInstance = new OBSServer(serverPort);
  }
  return obsServerInstance;
}
