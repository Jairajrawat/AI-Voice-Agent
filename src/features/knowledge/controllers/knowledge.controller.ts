import { NextFunction,Request, Response } from 'express';

import { CreateKnowledgeItemInput, UpdateKnowledgeItemInput } from '../schemas/knowledge.schema';
import { KnowledgeService } from '../services/knowledge.service';

export class KnowledgeController {
  private knowledgeService: KnowledgeService;

  constructor() {
    this.knowledgeService = new KnowledgeService();
  }

  create = async (
    req: Request<{ tenantId: string }, {}, CreateKnowledgeItemInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const result = await this.knowledgeService.create(tenantId, req.body);

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
    req: Request<{ tenantId: string; knowledgeId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId, knowledgeId } = req.params;
      const result = await this.knowledgeService.findById(knowledgeId, tenantId);

      if (!result.success) {
        res.status(result.error === 'Knowledge item not found' ? 404 : 400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getAll = async (
    req: Request<
      { tenantId: string },
      {},
      {},
      { page?: string; limit?: string; category?: string }
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const category = req.query.category;

      const result = await this.knowledgeService.findByTenant(tenantId, {
        page,
        limit,
        category,
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil((result.total || 0) / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request<{ tenantId: string; knowledgeId: string }, {}, UpdateKnowledgeItemInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId, knowledgeId } = req.params;
      const result = await this.knowledgeService.update(knowledgeId, tenantId, req.body);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request<{ tenantId: string; knowledgeId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId, knowledgeId } = req.params;
      const result = await this.knowledgeService.delete(knowledgeId, tenantId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Knowledge item deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  search = async (
    req: Request<{ tenantId: string }, {}, {}, { query: string; limit?: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const { query, limit } = req.query;

      if (!query) {
        res.status(400).json({
          success: false,
          message: 'Query parameter is required',
        });
        return;
      }

      const result = await this.knowledgeService.search(
        tenantId,
        query,
        parseInt(limit as string) || 5,
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getContext = async (
    req: Request<{ tenantId: string }, {}, {}, { query?: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const { query } = req.query;

      const result = await this.knowledgeService.getContextForVocode(tenantId, query as string);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json({
        success: true,
        context: result.context,
      });
    } catch (error) {
      next(error);
    }
  };
}
