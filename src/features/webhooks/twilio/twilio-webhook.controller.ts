import { Request, Response } from 'express';

import { env } from '../../../config/env-config';
import { PrismaService } from '../../../config/prisma.config';
import { contextService } from '../../../services/context.service';
import { vocodeService } from '../../../services/vocode.service';
import { CallerRepository } from '../../callers/repositories/caller.repository';
import { CallRepository } from '../../calls/repositories/call.repository';

export class TwilioWebhookController {
  private prisma = PrismaService.getInstance().client;
  private callerRepository = new CallerRepository(this.prisma);
  private callRepository = new CallRepository(this.prisma);

  handleIncomingCall = async (req: Request, res: Response): Promise<void> => {
    try {
      const { CallSid, From, To, Direction } = req.body as Record<string, string>;

      if (!CallSid || !From || !To) {
        res.status(400).json({
          success: false,
          message: 'Missing required Twilio fields',
        });
        return;
      }

      const existingCall = await this.prisma.call.findUnique({
        where: { externalId: CallSid },
        include: {
          caller: true,
          phoneNumber: {
            include: { tenant: true },
          },
        },
      });

      let tenantId: string;
      let callId: string;
      let callerId: string;

      if (existingCall) {
        tenantId = existingCall.tenantId;
        callId = existingCall.id;
        callerId = existingCall.callerId;
      } else {
        const phoneNumber = await this.prisma.phoneNumber.findUnique({
          where: { number: To },
          include: { tenant: true },
        });

        if (!phoneNumber) {
          res.status(404).json({
            success: false,
            message: 'Phone number not found',
          });
          return;
        }

        tenantId = phoneNumber.tenantId;
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

        const call = await this.callRepository.create({
          externalId: CallSid,
          tenantId,
          phoneNumberId: phoneNumber.id,
          callerId: caller.id,
          direction: Direction === 'outbound-api' ? 'OUTBOUND' : 'INBOUND',
          status: 'RINGING',
          provider: 'TWILIO',
        });

        callId = call.id;
        callerId = caller.id;
      }

      let vocodeConversationId = existingCall?.vocodeConversationId;
      if (!vocodeConversationId) {
        const contextResult = await contextService.buildCallContext(tenantId, callerId);
        if (!contextResult.success || !contextResult.context) {
          res.status(500).json({
            success: false,
            message: contextResult.error || 'Failed to build call context',
          });
          return;
        }

        const vocodeResult = await vocodeService.createConversation({
          callId,
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
          provider: 'twilio',
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
          vocodeConversationId = vocodeResult.conversationId;
          await this.prisma.call.update({
            where: { id: callId },
            data: { vocodeConversationId },
          });
        }
      }

      const streamUrl = this.resolveStreamUrl(vocodeConversationId);
      const twiml = streamUrl
        ? this.buildStreamTwiml(streamUrl, callId, tenantId)
        : this.buildFallbackTwiml();

      res.type('text/xml').status(200).send(twiml);
    } catch (error) {
      console.error('Error handling Twilio incoming call:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  handleStatusCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body as Record<string, string>;

      if (!CallSid || !CallStatus) {
        res.status(400).json({
          success: false,
          message: 'Missing required Twilio status fields',
        });
        return;
      }

      const call = await this.callRepository.findByExternalId(CallSid);
      if (!call) {
        res.status(404).json({
          success: false,
          message: 'Call not found',
        });
        return;
      }

      const statusMap: Record<string, string> = {
        queued: 'RINGING',
        ringing: 'RINGING',
        in_progress: 'IN_PROGRESS',
        completed: 'COMPLETED',
        busy: 'FAILED',
        failed: 'FAILED',
        no_answer: 'NO_ANSWER',
        canceled: 'FAILED',
      };
      const normalizedStatus = statusMap[CallStatus] || CallStatus.toUpperCase();

      await this.callRepository.updateStatus(call.id, normalizedStatus, {
        durationSecs: CallDuration ? parseInt(CallDuration, 10) : undefined,
      });

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
      console.error('Error handling Twilio status callback:', error);
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

  private escapeXml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private buildFallbackTwiml(): string {
    const greeting = this.escapeXml('Please stay on the line while we connect you.');
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${greeting}</Say><Pause length="60"/></Response>`;
  }

  private buildStreamTwiml(streamUrl: string, callId: string, tenantId: string): string {
    const escapedUrl = this.escapeXml(streamUrl);
    const escapedCallId = this.escapeXml(callId);
    const escapedTenantId = this.escapeXml(tenantId);
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${escapedUrl}"><Parameter name="callId" value="${escapedCallId}"/><Parameter name="tenantId" value="${escapedTenantId}"/></Stream></Connect></Response>`;
  }

  private resolveStreamUrl(vocodeConversationId?: string | null): string | null {
    if (!vocodeConversationId) {
      return null;
    }

    if (env.VOCODE_STREAM_URL) {
      if (env.VOCODE_STREAM_URL.includes('{conversationId}')) {
        return env.VOCODE_STREAM_URL.replace('{conversationId}', vocodeConversationId);
      }
      const separator = env.VOCODE_STREAM_URL.endsWith('/') ? '' : '/';
      return `${env.VOCODE_STREAM_URL}${separator}${vocodeConversationId}`;
    }

    // Fallback convention for self-hosted vocode telephony server.
    const wsBase = env.VOCODE_BASE_URL.replace(/^http:\/\//, 'ws://').replace(
      /^https:\/\//,
      'wss://',
    );
    return `${wsBase}/connect_call/${vocodeConversationId}`;
  }
}
