import axios, { AxiosInstance } from 'axios';

import { env } from '../config/env-config';
import { encryptionService } from '../utils/encryption.util';

/**
 * Vocode Service
 * Handles communication with the Vocode Python service
 */
export class VocodeService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.VOCODE_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.VOCODE_API_KEY || '',
      },
    });
  }

  /**
   * Create a new Vocode conversation
   * Called when a call comes in
   */
  async createConversation(config: {
    callId: string;
    tenantId: string;
    systemPrompt: string;
    voiceId?: string;
    language: string;
    sttProvider: string;
    ttsProvider: string;
    llmProvider: string;
    sttApiKey?: string;
    ttsApiKey?: string;
    llmApiKey?: string;
    provider?: string;
    fromPhone?: string;
    toPhone?: string;
    providerCallId?: string;
    context?: any;
  }): Promise<{ success: boolean; conversationId?: string; error?: string }> {
    try {
      const response = await this.client.post('/conversations', {
        call_id: config.callId,
        tenant_id: config.tenantId,
        system_prompt: config.systemPrompt,
        voice_id: config.voiceId,
        language: config.language,
        stt_provider: config.sttProvider.toLowerCase(),
        tts_provider: config.ttsProvider.toLowerCase(),
        llm_provider: config.llmProvider.toLowerCase(),
        stt_api_key: config.sttApiKey,
        tts_api_key: config.ttsApiKey,
        llm_api_key: config.llmApiKey,
        provider: config.provider,
        from_phone: config.fromPhone,
        to_phone: config.toPhone,
        provider_call_id: config.providerCallId,
        context: config.context,
      });

      return {
        success: true,
        conversationId: response.data.conversation_id,
      };
    } catch (error) {
      console.error('❌ Error creating Vocode conversation:', error);
      return {
        success: false,
        error: 'Failed to create conversation',
      };
    }
  }

  /**
   * End a Vocode conversation
   */
  async endConversation(conversationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.post(`/conversations/${conversationId}/end`);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error ending Vocode conversation:', error);
      return {
        success: false,
        error: 'Failed to end conversation',
      };
    }
  }

  /**
   * Transfer call via Vocode
   */
  async transferCall(
    conversationId: string,
    transferTo: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.post(`/conversations/${conversationId}/transfer`, {
        transfer_to: transferTo,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error transferring call:', error);
      return {
        success: false,
        error: 'Failed to transfer call',
      };
    }
  }

  /**
   * Health check for Vocode service
   */
  async healthCheck(): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await this.client.get('/health');
      return {
        success: true,
        message: response.data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Vocode service unreachable',
      };
    }
  }
}

// Export singleton
export const vocodeService = new VocodeService();
