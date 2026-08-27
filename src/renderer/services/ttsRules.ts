// TTS Rules - Message filtering and processing
// Applies configured rules before sending messages to TTS queue

interface TTSRules {
  filterCommands: boolean;
  filterUrls: boolean;
  filterBots: boolean;
  botList: string;
  announceUsername: boolean;
  usernameStyle: string;
  minLength: number;
  maxLength: number;
  skipDuplicates: boolean;
  duplicateWindow: number;
  userCooldown: boolean;
  userCooldownSeconds: number;
  globalCooldown: boolean;
  globalCooldownSeconds: number;
  limitEmotes: boolean;
  maxEmotes: number;
  limitEmojis: boolean;
  maxEmojis: number;
  limitRepeatedChars: boolean;
  maxRepeatedChars: number;
  limitLongNumbers: boolean;
  maxNumberLength: number;
  blockedWords: string[];
  blockedWordReplacement: string;
  pronunciations: Array<{ id: number; pattern: string; replacement: string; is_regex: boolean; match_case: boolean; enabled: boolean }>;
}

interface ChatMessage {
  viewer_id: string;
  username: string;
  display_name?: string;
  message: string;
  timestamp: string;
  emotes?: string; // JSON string like {"25":["4-8","14-18"]}
}

interface ProcessedMessage {
  text: string;
  shouldSpeak: boolean;
  reason?: string;
}

class TTSRulesService {
  private recentMessages: Map<string, number> = new Map(); // For duplicate detection
  private lastGlobalTTS: number = 0; // For global cooldown
  private lastUserTTS: Map<string, number> = new Map(); // For user cooldown

  /**
   * Load all TTS rules from database
   */
  async loadRules(): Promise<TTSRules> {
    try {
      const rules = await Promise.all([
        window.api.invoke('db:getSetting', 'tts_filter_commands'),
        window.api.invoke('db:getSetting', 'tts_filter_urls'),
        window.api.invoke('db:getSetting', 'tts_filter_bots'),
        window.api.invoke('db:getSetting', 'tts_bot_list'),
        window.api.invoke('db:getSetting', 'tts_announce_username'),
        window.api.invoke('db:getSetting', 'tts_username_style'),
        window.api.invoke('db:getSetting', 'tts_min_length'),
        window.api.invoke('db:getSetting', 'tts_max_length'),
        window.api.invoke('db:getSetting', 'tts_skip_duplicates'),
        window.api.invoke('db:getSetting', 'tts_duplicate_window'),
        window.api.invoke('db:getSetting', 'tts_user_cooldown'),
        window.api.invoke('db:getSetting', 'tts_user_cooldown_seconds'),
        window.api.invoke('db:getSetting', 'tts_global_cooldown'),
        window.api.invoke('db:getSetting', 'tts_global_cooldown_seconds'),
        window.api.invoke('db:getSetting', 'tts_limit_emotes'),
        window.api.invoke('db:getSetting', 'tts_max_emotes'),
        window.api.invoke('db:getSetting', 'tts_limit_emojis'),
        window.api.invoke('db:getSetting', 'tts_max_emojis'),
        window.api.invoke('db:getSetting', 'tts_limit_repeated_chars'),
        window.api.invoke('db:getSetting', 'tts_max_repeated_chars'),
        window.api.invoke('db:getSetting', 'tts_limit_long_numbers'),
        window.api.invoke('db:getSetting', 'tts_max_number_length'),
        window.api.invoke('db:getSetting', 'tts_blocked_words'),
        window.api.invoke('db:getSetting', 'tts_blocked_word_replacement'),
        window.api.invoke('db:query', 'SELECT * FROM tts_pronunciations WHERE enabled = 1 ORDER BY id'),
      ]);

      return {
        filterCommands: rules[0] !== 'false', // Default true (matches UI default)
        filterUrls: rules[1] !== 'false',
        filterBots: rules[2] !== 'false',
        botList: rules[3] || 'Nightbot,StreamElements,Streamlabs,Moobot,Fossabot,Wizebot',
        announceUsername: rules[4] !== 'false',
        usernameStyle: rules[5] || 'says',
        minLength: parseInt(rules[6] || '1'),
        maxLength: parseInt(rules[7] || '500'),
        skipDuplicates: rules[8] === 'true',
        duplicateWindow: parseInt(rules[9] || '60'),
        userCooldown: rules[10] === 'true',
        userCooldownSeconds: parseInt(rules[11] || '30'),
        globalCooldown: rules[12] === 'true',
        globalCooldownSeconds: parseInt(rules[13] || '5'),
        limitEmotes: rules[14] === 'true',
        maxEmotes: parseInt(rules[15] || '5'),
        limitEmojis: rules[16] === 'true',
        maxEmojis: parseInt(rules[17] || '5'),
        limitRepeatedChars: rules[18] === 'true',
        maxRepeatedChars: parseInt(rules[19] || '3'),
        limitLongNumbers: rules[20] === 'true',
        maxNumberLength: parseInt(rules[21] || '6'),
        blockedWords: (() => {
          if (!rules[22]) return [];
          try { return JSON.parse(rules[22]); }
          catch { return rules[22].split(',').map((w: string) => w.trim()).filter(Boolean); }
        })(),
        blockedWordReplacement: rules[23] || '[censored]',
        pronunciations: rules[24] ?? [],
      };
    } catch (error) {
      console.error('[ttsRules] loadRules error:', error);
      console.error('Failed to load TTS rules:', error);
      // Return defaults
      return {
        filterCommands: true,
        filterUrls: true,
        filterBots: true,
        botList: 'Nightbot,StreamElements,Streamlabs,Moobot,Fossabot,Wizebot',
        announceUsername: true,
        usernameStyle: 'says',
        minLength: 1,
        maxLength: 500,
        skipDuplicates: false,
        duplicateWindow: 60,
        userCooldown: false,
        userCooldownSeconds: 30,
        globalCooldown: false,
        globalCooldownSeconds: 5,
        limitEmotes: false,
        maxEmotes: 5,
        limitEmojis: false,
        maxEmojis: 5,
        limitRepeatedChars: false,
        maxRepeatedChars: 3,
        limitLongNumbers: false,
        maxNumberLength: 6,
        blockedWords: [],
        blockedWordReplacement: '[censored]',
        pronunciations: [],
      };
    }
  }

  /**
   * Process a message through all TTS rules
   */
  async processMessage(message: ChatMessage): Promise<ProcessedMessage> {
    const rules = await this.loadRules();
    let text = message.message.trim();

    // Debug: Log the raw message for emote inspection
    console.log('Processing message:', { username: message.username, text, message });

    // 0. Apply pronunciation substitutions first so filters see the substituted text
    console.log('[ttsRules] pronunciations active:', rules.pronunciations.map(p => p.pattern));
    for (const p of rules.pronunciations) {
      // All entries in rules.pronunciations are already enabled (fetched with WHERE enabled=1)
      try {
        const flags = p.match_case ? 'g' : 'gi';
        if (p.is_regex) {
          text = text.replace(new RegExp(p.pattern, flags), p.replacement);
        } else {
          const escaped = p.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          text = text.replace(new RegExp(`\\b${escaped}\\b`, flags), p.replacement);
        }
      } catch {
        // Invalid regex — skip this rule silently
      }
    }

    // 1. Filter commands (starting with ! only, ~ is handled by command processor)
    if (rules.filterCommands && text.startsWith('!')) {
      return { text, shouldSpeak: false, reason: 'Message is a command' };
    }

    // 2. Filter URLs
    if (rules.filterUrls && this.containsUrl(text)) {
      return { text, shouldSpeak: false, reason: 'Message contains URL' };
    }

    // 3. Filter bots
    if (rules.filterBots) {
      const bots = rules.botList.toLowerCase().split(',').map(b => b.trim());
      if (bots.includes(message.username.toLowerCase())) {
        return { text, shouldSpeak: false, reason: 'Message from bot' };
      }
    }

    // 4. Check message length
    if (text.length < rules.minLength) {
      return { text, shouldSpeak: false, reason: `Message too short (min: ${rules.minLength})` };
    }
    if (text.length > rules.maxLength) {
      text = text.substring(0, rules.maxLength);
    }

    // 5. Check for blocked words (case-insensitive) and replace them
    if (rules.blockedWords.length > 0) {
      const lowerText = text.toLowerCase();
      for (const word of rules.blockedWords) {
        const lowerWord = word.toLowerCase().trim();
        if (lowerWord && lowerText.includes(lowerWord)) {
          console.log(`Blocked word detected: ${word}, replacing in message`);
          // Replace all occurrences (case-insensitive)
          const regex = new RegExp(lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          text = text.replace(regex, rules.blockedWordReplacement);
        }
      }
    }

    // 6. Check duplicates
    if (rules.skipDuplicates) {
      const messageKey = `${message.viewer_id}:${text.toLowerCase()}`;
      const lastTime = this.recentMessages.get(messageKey);
      if (lastTime) {
        const timeDiff = (Date.now() - lastTime) / 1000;
        if (timeDiff < rules.duplicateWindow) {
          return { text, shouldSpeak: false, reason: 'Duplicate message' };
        }
      }
      this.recentMessages.set(messageKey, Date.now());
      this.cleanupOldMessages(rules.duplicateWindow);
    }

    // 7. Check user cooldown
    if (rules.userCooldown) {
      const lastUserTime = this.lastUserTTS.get(message.viewer_id);
      if (lastUserTime) {
        const timeDiff = (Date.now() - lastUserTime) / 1000;
        if (timeDiff < rules.userCooldownSeconds) {
          return { 
            text, 
            shouldSpeak: false, 
            reason: `User on cooldown (${Math.ceil(rules.userCooldownSeconds - timeDiff)}s remaining)` 
          };
        }
      }
    }

    // 8. Check global cooldown
    if (rules.globalCooldown) {
      const timeDiff = (Date.now() - this.lastGlobalTTS) / 1000;
      if (timeDiff < rules.globalCooldownSeconds) {
        return { 
          text, 
          shouldSpeak: false, 
          reason: `Global cooldown (${Math.ceil(rules.globalCooldownSeconds - timeDiff)}s remaining)` 
        };
      }
    }

    // 9. Limit emotes - remove extra emotes but keep the first N
    if (rules.limitEmotes && message.emotes) {
      text = this.limitEmotesInText(text, message.emotes, rules.maxEmotes);
    }

    // 10. Limit emojis (Unicode emojis like 😀, 🎉, etc.)
    if (rules.limitEmojis) {
      text = this.limitEmojis(text, rules.maxEmojis);
    }

    // 11. Limit long numbers (before repeated chars to avoid affecting it)
    if (rules.limitLongNumbers) {
      text = this.limitLongNumbers(text, rules.maxNumberLength);
    }

    // 12. Limit repeated characters (only for letters, not numbers)
    if (rules.limitRepeatedChars) {
      text = this.limitRepeatedCharacters(text, rules.maxRepeatedChars);
    }

    // 13. Add username announcement
    if (rules.announceUsername) {
      const displayName = message.display_name || message.username;
      switch (rules.usernameStyle) {
        case 'says':
          text = `${displayName} says: ${text}`;
          break;
        case 'from':
          text = `From ${displayName}: ${text}`;
          break;
        case 'colon':
          text = `${displayName}: ${text}`;
          break;
      }
    }

    // Update cooldown tracking
    if (rules.userCooldown) {
      this.lastUserTTS.set(message.viewer_id, Date.now());
    }
    if (rules.globalCooldown) {
      this.lastGlobalTTS = Date.now();
    }

    return { text, shouldSpeak: true };
  }

  private containsUrl(text: string): boolean {
    // Match http://, https://, www., or common TLDs
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[a-z]{2,})|([a-zA-Z0-9-]+\.(com|net|org|io|tv|gg|xyz|co\.uk|edu|gov|me|info)(\/[^\s]*)?)/gi;
    return urlRegex.test(text);
  }

  private countEmotes(emotesStr: string): number {
    try {
      const emotesData = JSON.parse(emotesStr);
      // Count total emote instances by counting all position arrays
      return Object.values(emotesData).reduce((sum: number, positions: any) => {
        return sum + (Array.isArray(positions) ? positions.length : 0);
      }, 0);
    } catch (err) {
      console.error('Failed to parse emotes:', err);
      return 0;
    }
  }

  private limitEmotesInText(text: string, emotesStr: string, maxEmotes: number): string {
    try {
      const emotesData = JSON.parse(emotesStr);
      
      // Collect all emote positions with their ranges
      const emotePositions: Array<{ start: number; end: number }> = [];
      for (const positions of Object.values(emotesData)) {
        if (Array.isArray(positions)) {
          for (const pos of positions) {
            const [start, end] = pos.split('-').map(Number);
            emotePositions.push({ start, end });
          }
        }
      }
      
      // Sort by position (earliest first)
      emotePositions.sort((a, b) => a.start - b.start);
      
      const emoteCount = emotePositions.length;
      console.log(`Detected ${emoteCount} emotes, limit is ${maxEmotes}`);
      
      if (emoteCount <= maxEmotes) {
        return text; // Within limit, return as-is
      }
      
      // Remove emotes beyond the limit (working backwards to preserve indices)
      const emotesToRemove = emotePositions.slice(maxEmotes);
      emotesToRemove.reverse(); // Remove from end to start
      
      let result = text;
      for (const { start, end } of emotesToRemove) {
        // Replace emote with empty string
        result = result.substring(0, start) + result.substring(end + 1);
      }
      
      // Clean up extra spaces
      result = result.replace(/\s+/g, ' ').trim();
      
      console.log(`Removed ${emotesToRemove.length} emotes, kept first ${maxEmotes}`);
      return result;
    } catch (err) {
      console.error('Failed to limit emotes:', err);
      return text;
    }
  }

  private limitEmotes(text: string, maxEmotes: number): string {
    // Simple heuristic: words that are all caps or contain no spaces are likely emotes
    const words = text.split(/\s+/);
    let emoteCount = 0;
    const result: string[] = [];

    for (const word of words) {
      // Consider it an emote if it's all caps and more than 2 chars (rough heuristic)
      const isLikelyEmote = /^[A-Z0-9]+$/.test(word) && word.length > 2;
      
      if (isLikelyEmote) {
        emoteCount++;
        if (emoteCount <= maxEmotes) {
          result.push(word);
        }
        // Skip emotes beyond the limit
      } else {
        result.push(word);
      }
    }

    return result.join(' ');
  }

  private limitEmojis(text: string, maxEmojis: number): string {
    // Unicode emoji regex (covers most common emojis)
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    
    let count = 0;
    return text.replace(emojiRegex, (emoji) => {
      count++;
      return count <= maxEmojis ? emoji : '';
    });
  }

  private limitRepeatedCharacters(text: string, maxRepeat: number): string {
    // Replace sequences of repeated LETTERS ONLY (not digits)
    // This prevents affecting numbers like 10000
    const regex = new RegExp(`([a-zA-Z])\\1{${maxRepeat},}`, 'gi');
    return text.replace(regex, (match, char) => char.repeat(maxRepeat));
  }

  private limitLongNumbers(text: string, maxLength: number): string {
    // Replace long sequences of digits with [number]
    // Example: 123456789 with maxLength=6 becomes [number]
    const regex = new RegExp(`\\b\\d{${maxLength + 1},}\\b`, 'g');
    return text.replace(regex, '[number]');
  }

  private cleanupOldMessages(windowSeconds: number): void {
    const cutoff = Date.now() - (windowSeconds * 1000);
    for (const [key, time] of this.recentMessages.entries()) {
      if (time < cutoff) {
        this.recentMessages.delete(key);
      }
    }
  }
}

// Singleton instance
let ttsRulesService: TTSRulesService | null = null;

export function getTTSRulesService(): TTSRulesService {
  if (!ttsRulesService) {
    ttsRulesService = new TTSRulesService();
  }
  return ttsRulesService;
}
