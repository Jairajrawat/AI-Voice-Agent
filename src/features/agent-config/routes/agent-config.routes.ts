import { Router } from 'express';

import { PrismaService } from '../../../config/prisma.config';
import { validateRequest } from '../../../middleware/validation.middleware';
import { AgentConfigController } from '../controllers/agent-config.controller';
import { AgentConfigRepository } from '../repositories/agent-config.repository';
import { AgentConfigService } from '../services/agent-config.service';
import { createAgentConfigSchema, updateAgentConfigSchema } from '../schemas/agent-config.schema';

// Dependency Injection
const prismaService = PrismaService.getInstance();
const prisma = prismaService.client;
const agentConfigRepository = new AgentConfigRepository(prisma);
const agentConfigService = new AgentConfigService(agentConfigRepository);
const agentConfigController = new AgentConfigController(agentConfigService);

const router = Router({ mergeParams: true });

// Agent config routes for a tenant
router.post('/', validateRequest(createAgentConfigSchema), agentConfigController.create);
router.get('/', agentConfigController.getByTenantId);
router.put('/', validateRequest(updateAgentConfigSchema), agentConfigController.update);
router.delete('/', agentConfigController.delete);

export default router;
