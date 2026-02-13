import { PrismaService } from '../config/prisma.config';
import { AgentConfigRepository } from '../features/agent-config/repositories/agent-config.repository';
import { CallerRepository } from '../features/callers/repositories/caller.repository';
import { CallRepository } from '../features/calls/repositories/call.repository';

export interface CallerContext {
  callerId: string;
  callerName?: string;
  phoneNumber: string;
  isReturning: boolean;
  totalCalls: number;
  previousAppointments?: any[];
  previousOrders?: any[];
  preferences?: Record<string, any>;
  lastSummary?: string;
  firstCallAt: Date;
  lastCallAt: Date;
}

export interface VocodeContext {
  systemPrompt: string;
  callerContext: CallerContext;
  sttProvider: string;
  ttsProvider: string;
  llmProvider: string;
  sttApiKey?: string;
  ttsApiKey?: string;
  llmApiKey?: string;
  voiceId?: string;
  language: string;
  maxCallDuration: number;
  greeting?: string;
  fallbackMessage?: string;
  enableMemory: boolean;
  enableExtraction: boolean;
}

/**
 * Context Service
 * Builds caller context and Vocode configuration from database
 */
export class ContextService {
  private prisma = PrismaService.getInstance().client;
  private callerRepository = new CallerRepository(this.prisma);
  private callRepository = new CallRepository(this.prisma);
  private agentConfigRepository = new AgentConfigRepository(this.prisma);

  /**
   * Build complete context for a call
   * Called when webhook receives a new call
   */
  async buildCallContext(
    tenantId: string,
    callerId: string,
  ): Promise<{ success: boolean; context?: VocodeContext; error?: string }> {
    try {
      // Get caller details
      const caller = await this.callerRepository.findById(callerId);
      if (!caller) {
        return { success: false, error: 'Caller not found' };
      }

      // Get agent config
      const agentConfig = await this.agentConfigRepository.findByTenantId(tenantId);
      if (!agentConfig) {
        return { success: false, error: 'Agent config not found' };
      }

      // Get previous calls with extractions for context
      const previousCalls = await this.prisma.call.findMany({
        where: {
          tenantId,
          callerId,
        },
        take: 5,
        orderBy: { startedAt: 'desc' },
        include: {
          extractions: true,
        },
      });

      // Extract structured data from previous calls
      const previousAppointments: any[] = [];
      const previousOrders: any[] = [];

      for (const call of previousCalls) {
        if (call.extractions && call.extractions.length > 0) {
          for (const extraction of call.extractions) {
            if (extraction.type === 'appointment') {
              previousAppointments.push(extraction.data);
            } else if (extraction.type === 'order') {
              previousOrders.push(extraction.data);
            }
          }
        }
      }

      // Build caller context
      const callerContext: CallerContext = {
        callerId: caller.id,
        callerName: caller.name || undefined,
        phoneNumber: caller.phoneNumber,
        isReturning: caller.totalCalls > 1,
        totalCalls: caller.totalCalls,
        previousAppointments: previousAppointments.length > 0 ? previousAppointments : undefined,
        previousOrders: previousOrders.length > 0 ? previousOrders : undefined,
        preferences: (caller.preferences as Record<string, any>) || undefined,
        firstCallAt: caller.firstCallAt,
        lastCallAt: caller.lastCallAt,
      };

      // Get last call summary if available
      const lastCall = previousCalls[0];
      if (lastCall && lastCall.summary) {
        callerContext.lastSummary = lastCall.summary;
      }

      // Decrypt API keys
      const decryptedKeys = this.agentConfigRepository.decryptApiKeys(agentConfig.providerApiKeys);

      // Build complete Vocode context
      const vocodeContext: VocodeContext = {
        systemPrompt: agentConfig.systemPrompt,
        callerContext,
        sttProvider: agentConfig.sttProvider,
        ttsProvider: agentConfig.ttsProvider,
        llmProvider: agentConfig.llmProvider,
        sttApiKey: decryptedKeys?.stt,
        ttsApiKey: decryptedKeys?.tts,
        llmApiKey: decryptedKeys?.llm,
        voiceId: agentConfig.voiceId || undefined,
        language: agentConfig.language,
        maxCallDuration: agentConfig.maxCallDuration,
        greeting: agentConfig.greeting || undefined,
        fallbackMessage: agentConfig.fallbackMessage || undefined,
        enableMemory: agentConfig.enableMemory,
        enableExtraction: agentConfig.enableExtraction,
      };

      return {
        success: true,
        context: vocodeContext,
      };
    } catch (error) {
      console.error('❌ Error building call context:', error);
      return {
        success: false,
        error: 'Failed to build call context',
      };
    }
  }

  /**
   * Format context for LLM injection
   * Creates a natural language summary for the AI
   */
  formatContextForLLM(context: CallerContext): string {
    let prompt = '';

    if (context.isReturning) {
      prompt += `This is a returning caller. `;
      prompt += `They have called ${context.totalCalls} times. `;

      if (context.callerName) {
        prompt += `Their name is ${context.callerName}. `;
      }

      if (context.lastSummary) {
        prompt += `Last conversation summary: ${context.lastSummary}. `;
      }

      if (context.previousAppointments && context.previousAppointments.length > 0) {
        prompt += `Previous appointments: ${JSON.stringify(context.previousAppointments)}. `;
      }

      if (context.previousOrders && context.previousOrders.length > 0) {
        prompt += `Previous orders: ${JSON.stringify(context.previousOrders)}. `;
      }

      if (context.preferences) {
        prompt += `Preferences: ${JSON.stringify(context.preferences)}. `;
      }
    } else {
      prompt += `This is a first-time caller. `;
    }

    return prompt;
  }
}

// Export singleton
export const contextService = new ContextService();
