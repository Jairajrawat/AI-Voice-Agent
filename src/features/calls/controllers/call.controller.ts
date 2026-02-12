import { NextFunction, Request, Response } from 'express';

import { ListCallsQuery, UpdateCallInput } from '../schemas/call.schema';
import { CallService } from '../services/call.service';

export class CallController {
  private callService: CallService;

  constructor() {
    this.callService = new CallService();
  }

  getById = async (
    req: Request<{ tenantId: string; callId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId, callId } = req.params;
      const call = await this.callService.findById(callId, tenantId);

      if (!call) {
        res.status(404).json({
          success: false,
          message: 'Call not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: call,
      });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const from = req.query.from as string;
      const to = req.query.to as string;

      const result = await this.callService.findByTenant(tenantId, {
        page,
        limit,
        status,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result.calls,
        pagination: {
          page: page || 1,
          limit: limit || 10,
          total: result.total,
          totalPages: Math.ceil(result.total / (limit || 10)),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request<{ tenantId: string; callId: string }, {}, UpdateCallInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId, callId } = req.params;
      const call = await this.callService.update(callId, tenantId, req.body);

      res.status(200).json({
        success: true,
        data: call,
      });
    } catch (error) {
      next(error);
    }
  };

  triggerOutbound = async (
    req: Request<{ tenantId: string }, {}, { phoneNumberId: string; toNumber: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const { phoneNumberId, toNumber } = req.body;

      const result = await this.callService.triggerOutboundCall(tenantId, phoneNumberId, toNumber);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request<{ tenantId: string; callId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId, callId } = req.params;
      await this.callService.delete(callId, tenantId);

      res.status(200).json({
        success: true,
        message: 'Call deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
