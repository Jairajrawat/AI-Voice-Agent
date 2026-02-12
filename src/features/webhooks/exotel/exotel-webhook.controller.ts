import { Request, Response } from 'express';

import { PrismaService } from '../../../config/prisma.config';
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
      const { CallSid, From, To, Direction, CallStatus, DialWhomNumber } = req.body;

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

      // TODO: Connect to Vocode service
      // For now, return success to Exotel
      res.status(200).json({
        success: true,
        message: 'Call received',
        callId: call.id,
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
