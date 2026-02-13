import { NextFunction,Request, Response } from 'express';

import { updateCallerSchema } from '../schemas/caller.schema';
import { CallerService } from '../services/caller.service';

export class CallerController {
  private callerService: CallerService;

  constructor() {
    this.callerService = new CallerService();
  }

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, callerId } = req.params;
      const caller = await this.callerService.findById(callerId, tenantId);

      if (!caller) {
        res.status(404).json({ success: false, message: 'Caller not found' });
        return;
      }

      res.status(200).json({ success: true, data: caller });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const isSaved =
        req.query.isSaved === 'true' ? true : req.query.isSaved === 'false' ? false : undefined;
      const search = req.query.search as string;

      const result = await this.callerService.findByTenant(tenantId, {
        page,
        limit,
        isSaved,
        search,
      });

      res.status(200).json({
        success: true,
        data: result.callers,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, callerId } = req.params;
      const caller = await this.callerService.update(callerId, tenantId, req.body);
      res.status(200).json({ success: true, data: caller });
    } catch (error) {
      if (error instanceof Error && error.message === 'Caller not found') {
        res.status(404).json({ success: false, message: 'Caller not found' });
        return;
      }
      next(error);
    }
  };

  saveCaller = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, callerId } = req.params;
      const caller = await this.callerService.saveCaller(callerId, tenantId);
      res.status(200).json({ success: true, message: 'Caller saved', data: caller });
    } catch (error) {
      if (error instanceof Error && error.message === 'Caller not found') {
        res.status(404).json({ success: false, message: 'Caller not found' });
        return;
      }
      next(error);
    }
  };

  unsaveCaller = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, callerId } = req.params;
      const caller = await this.callerService.unsaveCaller(callerId, tenantId);
      res.status(200).json({ success: true, message: 'Caller unsaved', data: caller });
    } catch (error) {
      if (error instanceof Error && error.message === 'Caller not found') {
        res.status(404).json({ success: false, message: 'Caller not found' });
        return;
      }
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, callerId } = req.params;
      await this.callerService.delete(callerId, tenantId);
      res.status(200).json({ success: true, message: 'Caller deleted' });
    } catch (error) {
      if (error instanceof Error && error.message === 'Caller not found') {
        res.status(404).json({ success: false, message: 'Caller not found' });
        return;
      }
      next(error);
    }
  };
}
