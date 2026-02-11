import { NextFunction, Request, Response } from 'express';

import { CreateAgentConfigInput, UpdateAgentConfigInput } from '../schemas/agent-config.schema';
import { AgentConfigService } from '../services/agent-config.service';

export class AgentConfigController {
  constructor(private agentConfigService: AgentConfigService) {}

  create = async (
    req: Request<{ tenantId: string }, {}, CreateAgentConfigInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const result = await this.agentConfigService.createConfig({
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

  getByTenantId = async (
    req: Request<{ tenantId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const result = await this.agentConfigService.getConfigByTenantId(tenantId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request<{ tenantId: string }, {}, UpdateAgentConfigInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const result = await this.agentConfigService.updateConfig(tenantId, req.body);

      if (!result.success) {
        res.status(result.error === 'Agent config not found' ? 404 : 400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request<{ tenantId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const result = await this.agentConfigService.deleteConfig(tenantId);

      if (!result.success) {
        res.status(result.error === 'Agent config not found' ? 404 : 400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
