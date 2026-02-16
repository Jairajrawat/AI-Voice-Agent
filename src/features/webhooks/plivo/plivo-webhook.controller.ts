import { Request, Response } from 'express';

import { PrismaService } from '../../../config/prisma.config';
import { contextService } from '../../../services/context.service';
import { vocodeService } from '../../../services/vocode.service';
import { CallerRepository } from '../../callers/repositories/caller.repository';
import { CallRepository } from '../../calls/repositories/call.repository';

/**
 * Plivo Webhook Controller
 * Handles incoming webhooks from Plivo telephony provider
 */
export class PlivoWebhookController {
  private prisma = PrismaService.getInstance().client;
  private callerRepository = new CallerRepository(this.prisma);
  private callRepository = new CallRepository(this.prisma);

  /**
   * Handle incoming call webhook
   */
  handleIncomingCall = async (req: Request, res: Response): Promise<void> => {
    try {
      const { CallUUID, From, To, Direction, CallStatus } = req.body;

      console.log(`📞 Plivo incoming call: ${CallUUID} from ${From} to ${To}`);

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
        caller = await this.callerRepository.create({
          tenantId,
          phoneNumber: From,
          expiresAt: this.calculateExpiryDate(phoneNumber.tenant.dataRetentionDays),
        });
      } else {
        await this.callerRepository.updateLastCall(caller.id);
      }

      // Create call record
      const call = await this.callRepository.create({
        externalId: CallUUID,
        tenantId,
        phoneNumberId: phoneNumber.id,
        callerId: caller.id,
        direction: Direction === 'inbound' ? 'INBOUND' : 'OUTBOUND',
        status: 'RINGING',
        provider: 'PLIVO',
      });

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
        provider: 'plivo',
        fromPhone: From,
        toPhone: To,
        providerCallId: CallUUID,
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
      console.error('❌ Error handling Plivo incoming call:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  /**
   * Handle call status callback
   */
  handleStatusCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { CallUUID, CallStatus, Duration, RecordUrl } = req.body;

      console.log(`📊 Plivo status callback: ${CallUUID} - ${CallStatus}`);

      const call = await this.callRepository.findByExternalId(CallUUID);

      if (!call) {
        res.status(404).json({
          success: false,
          message: 'Call not found',
        });
        return;
      }

      const statusMap: Record<string, string> = {
        ringing: 'RINGING',
        answered: 'IN_PROGRESS',
        completed: 'COMPLETED',
        failed: 'FAILED',
        'no-answer': 'NO_ANSWER',
        busy: 'FAILED',
      };

      const newStatus = statusMap[CallStatus] || CallStatus.toUpperCase();

      await this.callRepository.updateStatus(call.id, newStatus, {
        durationSecs: Duration ? parseInt(Duration) : undefined,
      });

      if (RecordUrl) {
        await this.prisma.recording.create({
          data: {
            callId: call.id,
            url: RecordUrl,
            format: 'mp3',
          },
        });
      }

      res.status(200).json({
        success: true,
        message: 'Status updated',
      });
    } catch (error) {
      console.error('❌ Error handling Plivo status callback:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  private calculateExpiryDate(retentionDays: number): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + retentionDays);
    return expiryDate;
  }
}
