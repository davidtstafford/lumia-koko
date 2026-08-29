// Lumia Stream WebSocket Service
// Connects to the local Lumia Stream WebSocket API at ws://localhost:39231
// and forwards chat events into the app exactly as TwitchService did.

import WebSocket from 'ws';
import { DatabaseService, ChatMessage } from '../database/service';
import { CommandProcessor, CommandContext } from '../commands/commandProcessor';

type MessageCallback = (message: ChatMessage) => void;
type ConnectionCallback = (connected: boolean, error?: string) => void;
type ClearQueueCallback = () => void;
type SkipCurrentCallback = () => void;

const LUMIA_WS_PORT = 39231;

export class LumiaService {
  private ws: WebSocket | null = null;
  private messageQueue: ChatMessage[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private onMessageCallback?: MessageCallback;
  private onConnectionStatusCallback?: ConnectionCallback;
  private onClearQueueCallback?: ClearQueueCallback;
  private onSkipCurrentCallback?: SkipCurrentCallback;
  private wasConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private apiKey: string | null = null;
  private commandProcessor: CommandProcessor;
  private destroyed = false;
  // Texts of recent bot replies — used to suppress the relay echo from TTS.
  // Entries expire after 10 s, covering all platforms the message was sent to.
  private pendingBotReplies = new Set<string>();

  constructor() {
    this.commandProcessor = new CommandProcessor();
    this.batchInterval = setInterval(() => this.flushMessageQueue(), 5000);
  }

  async connect(apiKey: string): Promise<void> {
    if (this.ws) await this.disconnect();

    this.apiKey = apiKey;
    this.reconnectAttempts = 0;
    this.destroyed = false;

    return this.openConnection();
  }

  private openConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.apiKey) return reject(new Error('No API key'));

      const url = `ws://localhost:${LUMIA_WS_PORT}/api?token=${encodeURIComponent(this.apiKey)}&name=lumia-koko`;
      console.log(`[Lumia] Connecting to ${url}`);

      this.ws = new WebSocket(url);

      const onOpen = () => {
        console.log('[Lumia] Connected');
        this.wasConnected = true;
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        this.onConnectionStatusCallback?.(true);
        resolve();
      };

      const onError = (err: Error) => {
        console.error('[Lumia] WebSocket error:', err.message);
        this.onConnectionStatusCallback?.(false, err.message);
        reject(err);
      };

      this.ws.once('open', onOpen);
      this.ws.once('error', onError);

      this.ws.on('open', () => {
        this.ws?.removeListener('error', onError);
      });

      this.ws.on('message', (raw: WebSocket.Data) => {
        this.handleRawMessage(raw.toString());
      });

      this.ws.on('close', () => {
        console.log('[Lumia] WebSocket closed');
        this.onConnectionStatusCallback?.(false);
        if (this.wasConnected && !this.destroyed && this.apiKey) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err: Error) => {
        console.error('[Lumia] WS error (post-connect):', err.message);
        this.onConnectionStatusCallback?.(false, err.message);
        if (this.wasConnected && !this.destroyed && this.apiKey) {
          this.scheduleReconnect();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    this.wasConnected = false;
    this.apiKey = null;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.flushMessageQueue();
    if (this.ws) {
      try { this.ws.terminate(); } catch {}
      this.ws = null;
    }
    this.onConnectionStatusCallback?.(false);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  onMessage(cb: MessageCallback): void               { this.onMessageCallback = cb; }
  onConnectionStatus(cb: ConnectionCallback): void   { this.onConnectionStatusCallback = cb; }
  onClearQueue(cb: ClearQueueCallback): void         { this.onClearQueueCallback = cb; }
  onSkipCurrent(cb: SkipCurrentCallback): void       { this.onSkipCurrentCallback = cb; }

  destroy(): void {
    this.destroyed = true;
    if (this.batchInterval) clearInterval(this.batchInterval);
    this.disconnect().catch(() => {});
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isConnected() || this.destroyed) return;
    const delay = Math.min(60000, 5000 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts++;
    console.log(`[Lumia] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.isConnected() || !this.apiKey || this.destroyed) return;
      console.log('[Lumia] Attempting reconnect...');
      try {
        if (this.ws) { try { this.ws.terminate(); } catch {} this.ws = null; }
        await this.openConnection();
      } catch (err) {
        console.error('[Lumia] Reconnect failed:', err);
        if (this.reconnectAttempts < 8 && !this.destroyed) this.scheduleReconnect();
      }
    }, delay);
  }

  private handleRawMessage(raw: string): void {
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    // Lumia sends chat events with top-level type === 'chat'
    // or wrapped as { origin: 'lumia', type: 'event', data: { type: 'chat', ... } }
    // Handle both formats.
    let eventType: string | undefined;
    let data: any;

    if (payload.type === 'chat') {
      // Direct format (as seen in overlay code)
      eventType = 'chat';
      data = payload.data ?? {};
    } else if (payload.type === 'event' && payload.data?.type === 'chat') {
      // Wrapped format (as documented)
      eventType = 'chat';
      data = payload.data ?? {};
    }

    if (eventType !== 'chat') return;

    const username = (
      data?.extraSettings?.username ||
      data?.username ||
      ''
    ).trim().toLowerCase();

    if (!username) return;

    const displayName = (
      data?.extraSettings?.displayName ||
      data?.extraSettings?.display_name ||
      data?.displayName ||
      data?.display_name ||
      username
    ).trim() || username;

    // Extract message text
    const message = (
      data?.message ||
      data?.extraSettings?.message ||
      ''
    ).trim();

    if (!message) return;

    const platform: string = (data?.platform ?? 'lumia').toLowerCase();

    // Extract Lumia's own viewer UUID if present
    const lumiaViewerId: string | null = (
      data?.id ||
      data?.viewer_id ||
      data?.userId ||
      data?.user_id ||
      data?.extraSettings?.id ||
      data?.extraSettings?.viewer_id ||
      null
    ) as string | null;

    this.processChat(lumiaViewerId, username, displayName, message, platform);
  }

  private async processChat(lumiaId: string | null, username: string, displayName: string, message: string, platform: string): Promise<void> {
    // Suppress relay echoes of bot command replies.
    if (this.pendingBotReplies.has(message)) return;

    const viewerId = DatabaseService.findOrCreateViewer(lumiaId, username, displayName);
    DatabaseService.incrementViewerMessageCount(viewerId);

    if (message.trim().startsWith('~')) {
      await this.handleCommand(viewerId, displayName, username, platform, message);
      return;
    }

    const chatMessage: ChatMessage = {
      viewer_id: viewerId,
      username,
      display_name: displayName,
      message,
      timestamp: new Date().toISOString(),
      platform,
      was_read_by_tts: false
    };

    this.messageQueue.push(chatMessage);
    this.onMessageCallback?.(chatMessage);
  }

  private async handleCommand(viewerId: string, displayName: string, username: string, platform: string, message: string): Promise<void> {
    const viewerRow = DatabaseService.getViewerById(viewerId);
    const isModerator = viewerRow?.is_moderator === true || (viewerRow as any)?.is_moderator === 1;

    const ctx: CommandContext = {
      username,
      displayName,
      viewerId,
      isModerator,
      isBroadcaster: false,
      isVip: false,
      isSubscriber: false,
      message,
      channel: platform,
      platform,
    };

    const result = await this.commandProcessor.processMessage(ctx);
    if (!result) return;

    if (result.error === '__clearQueue') this.onClearQueueCallback?.();
    if (result.error === '__skipCurrent') this.onSkipCurrentCallback?.();

    if (result.response) {
      console.log(`[Lumia Command] Response to ${displayName}: ${result.response}`);
      // Post to chat via Lumia chatbot — Lumia will relay it back as a real chat
      // message which then goes through the normal TTS pipeline.
      this.sendChatbotMessage(result.response);
    }
  }

  private sendChatbotMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const raw = DatabaseService.getSetting('chatbot_platforms');
    const platforms: string[] = raw ? JSON.parse(raw) : [];
    if (platforms.length === 0) return;

    // Track the reply text so the relay echo is suppressed in processChat.
    this.pendingBotReplies.add(text);
    setTimeout(() => this.pendingBotReplies.delete(text), 10_000);

    for (const platform of platforms) {
      const packet = JSON.stringify({
        type: 'chatbot-message',
        params: {
          value: text,
          platform,
          userToChatAs: 'self',
        },
      });
      this.ws.send(packet);
      console.log(`[Lumia Chatbot] Sent reply to ${platform}: ${text}`);
    }
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;
    const msgs = [...this.messageQueue];
    this.messageQueue = [];
    DatabaseService.insertChatMessages(msgs);
  }
}

let lumiaService: LumiaService | null = null;

export function getLumiaService(): LumiaService {
  if (!lumiaService) lumiaService = new LumiaService();
  return lumiaService;
}
