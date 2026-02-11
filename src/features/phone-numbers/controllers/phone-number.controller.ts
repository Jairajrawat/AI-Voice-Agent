import { NextFunction, Request, Response } from 'express';

import { CreatePhoneNumberInput, UpdatePhoneNumberInput } from '../schemas/phone-number.schema';
import { PhoneNumberService } from '../services/phone-number.service';

export class PhoneNumberController {
  constructor(private phoneNumberService: PhoneNumberService) {}

  create = async (
    req: Request<{ tenantId: string }, {}, CreatePhoneNumberInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const result = await this.phoneNumberService.createPhoneNumber({
        ...req.body,
        tenantId,
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: Request<{ tenantId: string; phoneNumberId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { phoneNumberId } = req.params;
      const result = await this.phoneNumberService.getPhoneNumberById(phoneNumberId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getAll = async (
    req: Request<{ tenantId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const result = await this.phoneNumberService.getPhoneNumbersByTenant(tenantId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request<{ tenantId: string; phoneNumberId: string }, {}, UpdatePhoneNumberInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { phoneNumberId } = req.params;
      const result = await this.phoneNumberService.updatePhoneNumber(phoneNumberId, req.body);

      if (!result.success) {
        res.status(result.error === 'Phone number not found' ? 404 : 400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request<{ tenantId: string; phoneNumberId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { phoneNumberId } = req.params;
      const result = await this.phoneNumberService.deletePhoneNumber(phoneNumberId);

      if (!result.success) {
        res.status(result.error === 'Phone number not found' ? 404 : 400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
