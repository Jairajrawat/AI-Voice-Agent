import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../../../config/prisma.config';
import { CallService } from '../../services/call.service';
import {
  SaveTranscriptInput,
  SaveExtractionInput,
  CompleteCallInput,
  TransferCallInput,
} from '../schemas/internal.schema';

/**
 * Internal API Controller
 * Called by Vocode service to save call data
 */
export class InternalCallController {
  private prisma = PrismaService.getInstance().client;
  private callService = new CallService();

  /**
   * Save transcript chunk from Vocode
   */
  saveTranscript = async (
    req: Request<{ callId: string }, {}, SaveTranscriptInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { callId } = req.params;
      const { role, content, confidence } = req.body;

      const transcript = await this.prisma.transcript.create({
        data: {
          callId,
          role,
          content,
          confidence,
        },
      });

      console.log(`📝 Transcript saved for call ${callId}`);

      res.status(201).json({
        success: true,
        data: transcript,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Save extraction (structured data) from Vocode
   */
  saveExtraction = async (
    req: Request<{ callId: string }, {}, SaveExtractionInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { callId } = req.params;
      const { type, data, confidence } = req.body;

      const extraction = await this.prisma.extraction.create({
        data: {
          callId,
          type,
          data,
          confidence,
        },
      });

      console.log(`📊 Extraction saved for call ${callId}: ${type}`);

      res.status(201).json({
        success: true,
        data: extraction,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Mark call as completed
   */
  completeCall = async (
    req: Request<{ callId: string }, {}, CompleteCallInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { callId } = req.params;
      const { summary, sentiment } = req.body;

      const call = await this.callService.updateStatus(callId, 'COMPLETED', {
        endedAt: new Date(),
      });

      // Update summary and sentiment if provided
      if (summary || sentiment) {
        await this.prisma.call.update({
          where: { id: callId },
          data: {
            ...(summary && { summary }),
            ...(sentiment && { sentiment }),
          },
        });
      }

      console.log(`✅ Call ${callId} completed`);

      res.status(200).json({
        success: true,
        message: 'Call completed',
        data: call,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Transfer call to human agent
   */
  transferCall = async (
    req: Request<{ callId: string }, {}, TransferCallInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { callId } = req.params;
      const { transferTo } = req.body;

      // Update call status to transferred
      const call = await this.callService.updateStatus(callId, 'TRANSFERRED', {
        endedAt: new Date(),
      });

      // TODO: Actually trigger transfer via Exotel/Plivo API
      console.log(`📞 Call ${callId} transferred to ${transferTo}`);

      res.status(200).json({
        success: true,
        message: 'Call transferred',
        data: call,
      });
    } catch (error) {
      next(error);
    }
  };
}
