/**
 * Discord Service — Stream Koko
 * Provides slash commands to help viewers discover and set Kokoro voices.
 * No cloud-provider references; all voices are local Kokoro voice IDs.
 */

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  Interaction
} from 'discord.js';
import { DatabaseService } from '../database/service';
import { VoiceService } from '../database/voiceService';
import {
  getVoicesByFilters,
  getRandomVoice,
  getAvailableLanguages,
  formatVoicesForEmbed
} from './discordVoiceDiscovery';
import {
  setPaginationState,
  getPaginationState,
  updateCurrentPage,
  getPageVoices,
  getPaginationInfo,
  clearPaginationState
} from './discordPagination';

interface DiscordConfig {
  token: string;
  clientId: string;
  guildId?: string;
}

export class DiscordService {
  private client: Client | null = null;
  private config: DiscordConfig | null = null;
  private onConnectionStatusCallback?: (connected: boolean, error?: string) => void;

  async connect(config: DiscordConfig): Promise<void> {
    if (this.client) await this.disconnect();

    this.config = config;
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });

    this.setupEventHandlers();

    try {
      await this.client.login(config.token);
      await this.registerCommands();
      this.onConnectionStatusCallback?.(true);
    } catch (error) {
      console.error('Failed to connect to Discord:', error);
      this.onConnectionStatusCallback?.(false, String(error));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      this.client.destroy();
      this.client = null;
      this.onConnectionStatusCallback?.(false);
    } catch (err) {
      console.error('Error disconnecting Discord:', err);
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.isReady();
  }

  onConnectionStatus(cb: (connected: boolean, error?: string) => void): void {
    this.onConnectionStatusCallback = cb;
  }

  destroy(): void { this.disconnect().catch(() => {}); }

  // ── Slash commands ──────────────────────────────────────────────────────────

  private async registerCommands(): Promise<void> {
    if (!this.config) return;

    const commands = [
      new SlashCommandBuilder()
        .setName('searchvoice')
        .setDescription('Search for a Kokoro voice by name or ID')
        .addStringOption(o =>
          o.setName('query').setDescription('Voice name or ID to search for').setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('findvoice')
        .setDescription('Find Kokoro voices with optional filters')
        .addStringOption(o =>
          o.setName('language')
            .setDescription('Filter by language (e.g. American English, British English)')
            .setRequired(false)
        )
        .addStringOption(o =>
          o.setName('gender')
            .setDescription('Filter by gender')
            .setRequired(false)
            .addChoices(
              { name: 'Female', value: 'female' },
              { name: 'Male',   value: 'male'   }
            )
        ),

      new SlashCommandBuilder()
        .setName('randomvoice')
        .setDescription('Get a random Kokoro voice suggestion'),

      new SlashCommandBuilder()
        .setName('listlanguages')
        .setDescription('List all languages available in the Kokoro voice set'),

      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show Stream Koko help and voice commands'),

      new SlashCommandBuilder()
        .setName('commands')
        .setDescription('Show available Twitch chat commands for TTS')
    ].map(c => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(this.config.token);
    try {
      if (this.config.guildId) {
        await rest.put(
          Routes.applicationGuildCommands(this.config.clientId, this.config.guildId),
          { body: commands }
        );
      } else {
        await rest.put(Routes.applicationCommands(this.config.clientId), { body: commands });
      }
      console.log('Discord slash commands registered');
    } catch (err) {
      console.error('Failed to register Discord commands:', err);
    }
  }

  // ── Event handlers ──────────────────────────────────────────────────────────

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('ready', () => {
      console.log(`Discord bot ready as ${this.client?.user?.tag}`);
    });

    this.client.on('interactionCreate', async (interaction: Interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          await this.handleCommand(interaction);
        } else if (interaction.isButton()) {
          await this.handleButton(interaction);
        }
      } catch (err) {
        console.error('Discord interaction error:', err);
      }
    });
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const { commandName } = interaction;

    switch (commandName) {
      case 'searchvoice':   await this.cmdSearchVoice(interaction);   break;
      case 'findvoice':     await this.cmdFindVoice(interaction);     break;
      case 'randomvoice':   await this.cmdRandomVoice(interaction);   break;
      case 'listlanguages': await this.cmdListLanguages(interaction);  break;
      case 'help':          await this.cmdHelp(interaction);           break;
      case 'commands':      await this.cmdTwitchCommands(interaction); break;
      default:
        await interaction.editReply('Unknown command');
    }
  }

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [action, userId, interactionId] = interaction.customId.split(':');

    if (action !== 'voice_page') {
      await interaction.reply({ content: 'Unknown button', ephemeral: true });
      return;
    }

    const direction = interactionId.startsWith('next') ? 1 : -1;
    const baseId    = interactionId.replace(/^(next|prev)_/, '');
    const state     = getPaginationState(userId, baseId);

    if (!state) {
      await interaction.reply({ content: 'Pagination expired — please run the command again.', ephemeral: true });
      return;
    }

    updateCurrentPage(userId, baseId, state.currentPage + direction);
    const voices    = getPageVoices(userId, baseId);
    const info      = getPaginationInfo(userId, baseId);
    const embeds    = formatVoicesForEmbed(voices, 9);
    const row       = this.buildPaginationRow(userId, baseId, info!);

    await interaction.update({ embeds, components: [row] });
  }

  // ── Command implementations ────────────────────────────────────────────────

  private async cmdSearchVoice(interaction: ChatInputCommandInteraction): Promise<void> {
    const query  = interaction.options.getString('query', true);
    const voices = await getVoicesByFilters({ query });

    if (voices.length === 0) {
      await interaction.editReply(`No Kokoro voices found matching **${query}**.\nTry \`/findvoice\` with a language filter.`);
      return;
    }

    const embeds = formatVoicesForEmbed(voices.slice(0, 9), 9);
    embeds[0].setTitle(`🔍 Kokoro Voices matching "${query}"`);
    if (voices.length > 9) {
      embeds[embeds.length - 1].setFooter({ text: `Showing 9 of ${voices.length} results — use /findvoice to browse all` });
    }
    await interaction.editReply({ embeds });
  }

  private async cmdFindVoice(interaction: ChatInputCommandInteraction): Promise<void> {
    const language = interaction.options.getString('language') ?? undefined;
    const gender   = interaction.options.getString('gender')   ?? undefined;
    const voices   = await getVoicesByFilters({ language, gender });

    if (voices.length === 0) {
      await interaction.editReply('No voices found with those filters.');
      return;
    }

    const userId      = interaction.user.id;
    const baseId      = Date.now().toString();
    const itemsPerPage = 9;

    setPaginationState(userId, baseId, voices, { language, gender }, itemsPerPage);

    const page   = getPageVoices(userId, baseId);
    const info   = getPaginationInfo(userId, baseId)!;
    const embeds = formatVoicesForEmbed(page, itemsPerPage);
    embeds[0].setTitle('🎤 Kokoro Voices');

    if (info.totalPages > 1) {
      const row = this.buildPaginationRow(userId, baseId, info);
      await interaction.editReply({ embeds, components: [row] });
    } else {
      await interaction.editReply({ embeds });
    }
  }

  private async cmdRandomVoice(interaction: ChatInputCommandInteraction): Promise<void> {
    const voice = await getRandomVoice();

    if (!voice) {
      await interaction.editReply('No voices available. Start Stream Koko and load the model first.');
      return;
    }

    const genderIcon = voice.gender === 'female' ? '♀️' : voice.gender === 'male' ? '♂️' : '';
    const embed = new EmbedBuilder()
      .setColor(0x9146FF)
      .setTitle(`🎲 Random Voice Suggestion`)
      .addFields(
        { name: 'Name',         value: `${genderIcon} ${voice.name}`,      inline: true  },
        { name: 'Voice ID',     value: `\`${voice.voice_id}\``,            inline: true  },
        { name: 'Language',     value: voice.language_name,                 inline: true  },
        { name: 'Twitch cmd',   value: `\`~setvoice ${voice.voice_id}\``,  inline: false }
      );

    if (voice.description) embed.setFooter({ text: voice.description });
    await interaction.editReply({ embeds: [embed] });
  }

  private async cmdListLanguages(interaction: ChatInputCommandInteraction): Promise<void> {
    const languages = await getAvailableLanguages();
    const embed = new EmbedBuilder()
      .setColor(0x9146FF)
      .setTitle('🌍 Available Languages in Kokoro')
      .setDescription(languages.map(l => `• ${l}`).join('\n'));
    await interaction.editReply({ embeds: [embed] });
  }

  private async cmdHelp(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x9146FF)
      .setTitle('🎤 Stream Koko — Help')
      .setDescription(
        'Stream Koko uses **Kokoro AI** for 100% offline TTS. ' +
        'Voices are identified by their Kokoro voice ID (e.g. `af_heart`).\n\n' +
        'Use the Discord slash commands below to discover voices, ' +
        'then set yours in Twitch chat with `~setvoice <voice_id>`.'
      )
      .addFields(
        { name: 'Discord Commands', value: [
          '`/findvoice` — Browse voices with optional language/gender filters',
          '`/searchvoice <query>` — Quick search by name or ID',
          '`/randomvoice` — Get a random voice suggestion',
          '`/listlanguages` — See all available languages',
          '`/commands` — Show Twitch chat commands',
        ].join('\n') },
        { name: 'Twitch Chat Commands', value: [
          '`~setvoice <id>` — Set your TTS voice (e.g. `~setvoice af_heart`)',
          '`~voices` — List a sample of available voices',
          '`~setvoicespeed <0.25–4.0>` — Adjust your TTS speed',
        ].join('\n') }
      )
      .setFooter({ text: 'No cloud required — all TTS runs on your machine' });

    await interaction.editReply({ embeds: [embed] });
  }

  private async cmdTwitchCommands(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x9146FF)
      .setTitle('💬 Twitch Chat Commands')
      .addFields(
        { name: '👤 Viewer commands', value: [
          '`~setvoice <voice_id>` — Set your Kokoro voice',
          '`~voices [search]` — List voices (optional search term)',
          '`~setvoicespeed <speed>` — Set speed (0.25–4.0)',
          '`~hello` — Say hi and get a tip',
        ].join('\n') },
        { name: '🛡️ Moderator commands', value: [
          '`~mutevoice <user> [minutes]` — Mute a viewer\'s TTS',
          '`~unmutevoice <user>` — Unmute a viewer\'s TTS',
          '`~cooldownvoice <user> [seconds]` — Add cooldown',
          '`~uncooldownvoice <user>` — Remove cooldown',
          '`~mutetts` — Pause TTS globally',
          '`~unmutetts` — Resume TTS globally',
          '`~clearqueue` — Clear the TTS queue',
        ].join('\n') }
      );

    await interaction.editReply({ embeds: [embed] });
  }

  // ── Pagination helper ───────────────────────────────────────────────────────

  private buildPaginationRow(
    userId: string,
    baseId: string,
    info: { currentPage: number; totalPages: number; totalVoices: number }
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`voice_page:${userId}:prev_${baseId}`)
        .setLabel('◀ Prev')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(info.currentPage <= 1),
      new ButtonBuilder()
        .setCustomId(`voice_page:${userId}:info_${baseId}`)
        .setLabel(`Page ${info.currentPage}/${info.totalPages} (${info.totalVoices} voices)`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`voice_page:${userId}:next_${baseId}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(info.currentPage >= info.totalPages)
    );
  }
}

let discordService: DiscordService | null = null;

export function getDiscordService(): DiscordService {
  if (!discordService) discordService = new DiscordService();
  return discordService;
}
