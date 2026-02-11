import { AgentConfig, PrismaClient } from '@prisma/client';

import { encryptionService } from '../../../utils/encryption.util';
import { CreateAgentConfigInput, UpdateAgentConfigInput } from '../schemas/agent-config.schema';

export class AgentConfigRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateAgentConfigInput): Promise<AgentConfig> {
    // Encrypt API keys if provided
    const providerApiKeys: Record<string, string> = {};
    if (data.sttApiKey) providerApiKeys.stt = data.sttApiKey;
    if (data.ttsApiKey) providerApiKeys.tts = data.ttsApiKey;
    if (data.llmApiKey) providerApiKeys.llm = data.llmApiKey;

    const encryptedKeys =
      Object.keys(providerApiKeys).length > 0
        ? encryptionService.encryptObject(providerApiKeys)
        : null;

    return this.prisma.agentConfig.create({
      data: {
        tenantId: data.tenantId,
        systemPrompt: data.systemPrompt,
        voiceId: data.voiceId,
        language: data.language,
        sttProvider: data.sttProvider,
        ttsProvider: data.ttsProvider,
        llmProvider: data.llmProvider,
        telephonyProvider: data.telephonyProvider,
        providerApiKeys: encryptedKeys,
        maxCallDuration: data.maxCallDuration,
        greeting: data.greeting,
        fallbackMessage: data.fallbackMessage,
        enableMemory: data.enableMemory,
        enableExtraction: data.enableExtraction,
        enableRecording: data.enableRecording || false,
        extractionSchemas: data.extractionSchemas,
      },
    });
  }

  async findByTenantId(tenantId: string): Promise<AgentConfig | null> {
    return this.prisma.agentConfig.findUnique({
      where: { tenantId },
    });
  }

  async update(tenantId: string, data: UpdateAgentConfigInput): Promise<AgentConfig> {
    // Encrypt API keys if provided
    let encryptedKeys = undefined;
    if (data.sttApiKey || data.ttsApiKey || data.llmApiKey) {
      const providerApiKeys: Record<string, string> = {};
      if (data.sttApiKey) providerApiKeys.stt = data.sttApiKey;
      if (data.ttsApiKey) providerApiKeys.tts = data.ttsApiKey;
      if (data.llmApiKey) providerApiKeys.llm = data.llmApiKey;

      encryptedKeys = encryptionService.encryptObject(providerApiKeys);
    }

    return this.prisma.agentConfig.update({
      where: { tenantId },
      data: {
        ...(data.systemPrompt && { systemPrompt: data.systemPrompt }),
        ...(data.voiceId && { voiceId: data.voiceId }),
        ...(data.language && { language: data.language }),
        ...(data.sttProvider && { sttProvider: data.sttProvider }),
        ...(data.ttsProvider && { ttsProvider: data.ttsProvider }),
        ...(data.llmProvider && { llmProvider: data.llmProvider }),
        ...(data.telephonyProvider && { telephonyProvider: data.telephonyProvider }),
        ...(encryptedKeys && { providerApiKeys: encryptedKeys }),
        ...(data.maxCallDuration && { maxCallDuration: data.maxCallDuration }),
        ...(data.greeting && { greeting: data.greeting }),
        ...(data.fallbackMessage && { fallbackMessage: data.fallbackMessage }),
        ...(data.enableMemory !== undefined && { enableMemory: data.enableMemory }),
        ...(data.enableExtraction !== undefined && { enableExtraction: data.enableExtraction }),
        ...(data.enableRecording !== undefined && { enableRecording: data.enableRecording }),
        ...(data.extractionSchemas && { extractionSchemas: data.extractionSchemas }),
      },
    });
  }

  async delete(tenantId: string): Promise<AgentConfig> {
    return this.prisma.agentConfig.delete({
      where: { tenantId },
    });
  }

  /**
   * Decrypt and return API keys
   */
  decryptApiKeys(encryptedKeys: string | null): Record<string, string> | null {
    if (!encryptedKeys) return null;
    try {
      return encryptionService.decryptObject<Record<string, string>>(encryptedKeys);
    } catch (error) {
      console.error('Failed to decrypt API keys:', error);
      return null;
    }
  }
}
