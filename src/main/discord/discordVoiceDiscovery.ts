/**
 * Discord Voice Discovery — Kokoro-only
 * All voices come from the local tts_voices table (Kokoro voices, no cloud providers).
 */

import { VoiceService, KokoroVoice } from '../database/voiceService';
import { EmbedBuilder } from 'discord.js';

interface VoiceFilters {
  language?: string;
  gender?: string;
  query?: string;
}

export async function getVoicesByFilters(filters: VoiceFilters): Promise<KokoroVoice[]> {
  let voices = VoiceService.getAllVoices();

  if (filters.query) {
    voices = VoiceService.searchVoices(filters.query);
  }

  if (filters.language) {
    voices = voices.filter(v =>
      v.language_name.toLowerCase().includes(filters.language!.toLowerCase())
    );
  }

  if (filters.gender) {
    voices = voices.filter(v =>
      v.gender?.toLowerCase() === filters.gender!.toLowerCase()
    );
  }

  return voices;
}

export async function getRandomVoice(): Promise<KokoroVoice | null> {
  const voices = VoiceService.getAllVoices();
  if (voices.length === 0) return null;
  return voices[Math.floor(Math.random() * voices.length)];
}

export async function getAvailableLanguages(): Promise<string[]> {
  const voices = VoiceService.getAllVoices();
  const languages = new Set(voices.map(v => v.language_name));
  return Array.from(languages).sort();
}

export function formatVoicesForEmbed(voices: KokoroVoice[], maxPerEmbed = 9): EmbedBuilder[] {
  if (voices.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(0x9146FF)
        .setTitle('No voices found')
        .setDescription('Try a different search or check the Stream Koko app.')
    ];
  }

  const embeds: EmbedBuilder[] = [];

  for (let i = 0; i < voices.length; i += maxPerEmbed) {
    const chunk = voices.slice(i, i + maxPerEmbed);
    const embed = new EmbedBuilder().setColor(0x9146FF);

    for (const voice of chunk) {
      const genderIcon = voice.gender === 'female' ? '♀️' : voice.gender === 'male' ? '♂️' : '';
      const customTag  = voice.is_custom ? ' ⭐' : '';
      embed.addFields({
        name: `${genderIcon} ${voice.name}${customTag}`,
        value: [
          `**ID:** \`${voice.voice_id}\``,
          `**Language:** ${voice.language_name}`,
          voice.description ? `**Note:** ${voice.description}` : '',
          `**Command:** \`~setvoice ${voice.voice_id}\``
        ].filter(Boolean).join('\n'),
        inline: true
      });
    }

    embeds.push(embed);
  }

  return embeds;
}
