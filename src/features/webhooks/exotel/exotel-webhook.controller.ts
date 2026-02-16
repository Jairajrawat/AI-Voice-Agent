import { Request, Response } from 'express';

import { PrismaService } from '../../../config/prisma.config';
import { contextService } from '../../../services/context.service';
import { vocodeService } from '../../../services/vocode.service';
import { CallerRepository } from '../../callers/repositories/caller.repository';
import { CallRepository } from '../../calls/repositories/call.repository';

/**
 * Exotel Webhook Controller
 * Handles incoming webhooks from Exotel telephony provider
 */
export class ExotelWebhookController {
  private prisma = PrismaService.getInstance().client;
  private callerRepository = new CallerRepository(this.prisma);
  private callRepository = new CallRepository(this.prisma);

  /**
   * Handle incoming call webhook
   * Triggered when someone calls the Exotel number
   */
  handleIncomingCall = async (req: Request, res: Response): Promise<void> => {
    try {
      const { CallSid, From, To, Direction } = req.body;

      console.log(`📞 Exotel incoming call: ${CallSid} from ${From} to ${To}`);

      // Find tenant by phone number
      const phoneNumber = await this.prisma.phoneNumber.findUnique({
        where: { number: To },
        include: { tenant: true },
      });

      if (!phoneNumber) {
        console.error(`❌ Phone number ${To} not found`);
        res.status(404).json({
          success: false,
          message: 'Phone number not found',
        });
        return;
      }

      const tenantId = phoneNumber.tenantId;

      // Find or create caller
      let caller = await this.callerRepository.findByPhoneNumber(From, tenantId);

      if (!caller) {
        // Create new caller with expiry date
        caller = await this.callerRepository.create({
          tenantId,
          phoneNumber: From,
          expiresAt: this.calculateExpiryDate(phoneNumber.tenant.dataRetentionDays),
        });
        console.log(`✅ New caller created: ${caller.id}`);
      } else {
        // Update last call time
        await this.callerRepository.updateLastCall(caller.id);
      }

      // Create call record
      const call = await this.callRepository.create({
        externalId: CallSid,
        tenantId,
        phoneNumberId: phoneNumber.id,
        callerId: caller.id,
        direction: Direction === 'incoming' ? 'INBOUND' : 'OUTBOUND',
        status: 'RINGING',
        provider: 'EXOTEL',
      });

      console.log(`✅ Call record created: ${call.id}`);

      // Get agent config for this tenant
      const agentConfig = await this.prisma.agentConfig.findUnique({
        where: { tenantId },
      });

      if (!agentConfig) {
        console.error(`❌ Agent config not found for tenant ${tenantId}`);
        res.status(500).json({
          success: false,
          message: 'Agent configuration not found',
        });
        return;
      }

      const contextResult = await contextService.buildCallContext(tenantId, caller.id);
      if (!contextResult.success || !contextResult.context) {
        res.status(500).json({
          success: false,
          message: contextResult.error || 'Failed to build caller context',
        });
        return;
      }

      const vocodeResult = await vocodeService.createConversation({
        callId: call.id,
        tenantId,
        systemPrompt: contextResult.context.systemPrompt,
        voiceId: contextResult.context.voiceId,
        language: contextResult.context.language,
        sttProvider: contextResult.context.sttProvider,
        ttsProvider: contextResult.context.ttsProvider,
        llmProvider: contextResult.context.llmProvider,
        sttApiKey: contextResult.context.sttApiKey,
        ttsApiKey: contextResult.context.ttsApiKey,
        llmApiKey: contextResult.context.llmApiKey,
        provider: 'exotel',
        fromPhone: From,
        toPhone: To,
        providerCallId: CallSid,
        context: {
          callerContext: contextResult.context.callerContext,
          memoryPrompt: contextResult.context.enableMemory
            ? contextService.formatContextForLLM(contextResult.context.callerContext)
            : undefined,
          greeting: contextResult.context.greeting,
          fallbackMessage: contextResult.context.fallbackMessage,
          maxCallDuration: contextResult.context.maxCallDuration,
        },
      });

      if (vocodeResult.success && vocodeResult.conversationId) {
        await this.prisma.call.update({
          where: { id: call.id },
          data: { vocodeConversationId: vocodeResult.conversationId },
        });
      }

      res.status(200).json({
        success: true,
        message: 'Call received',
        callId: call.id,
        conversationId: vocodeResult.conversationId,
      });
    } catch (error) {
      console.error('❌ Error handling Exotel incoming call:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  /**
   * Handle call status callback
   * Triggered when call status changes (answered, completed, etc.)
   */
  handleStatusCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;

      console.log(`📊 Exotel status callback: ${CallSid} - ${CallStatus}`);

      // Find call by external ID
      const call = await this.callRepository.findByExternalId(CallSid);

      if (!call) {
        console.error(`❌ Call ${CallSid} not found`);
        res.status(404).json({
          success: false,
          message: 'Call not found',
        });
        return;
      }

      // Map Exotel status to our status
      const statusMap: Record<string, string> = {
        ringing: 'RINGING',
        'in-progress': 'IN_PROGRESS',
        completed: 'COMPLETED',
        failed: 'FAILED',
        'no-answer': 'NO_ANSWER',
        busy: 'FAILED',
      };

      const newStatus = statusMap[CallStatus] || CallStatus.toUpperCase();

      // Update call status
      await this.callRepository.updateStatus(call.id, newStatus, {
        durationSecs: CallDuration ? parseInt(CallDuration) : undefined,
      });

      // If recording URL provided, save it
      if (RecordingUrl) {
        await this.prisma.recording.create({
          data: {
            callId: call.id,
            url: RecordingUrl,
            format: 'mp3',
          },
        });
      }

      res.status(200).json({
        success: true,
        message: 'Status updated',
      });
    } catch (error) {
      console.error('❌ Error handling Exotel status callback:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  /**
   * Calculate expiry date based on tenant's data retention policy
   */
  private calculateExpiryDate(retentionDays: number): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + retentionDays);
    return expiryDate;
  }
}
