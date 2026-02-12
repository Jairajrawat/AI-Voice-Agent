import { Router } from 'express';

import { PrismaService } from '../../../config/prisma.config';
import { validateRequest } from '../../../middleware/validation.middleware';
import { TenantController } from '../controllers/tenant.controller';
import { TenantRepository } from '../repositories/tenant.repository';
import { TenantService } from '../services/tenant.service';
import { createTenantSchema, updateTenantSchema } from '../schemas/tenant.schema';

// Dependency Injection
const prismaService = PrismaService.getInstance();
const prisma = prismaService.client;
const tenantRepository = new TenantRepository(prisma);
const tenantService = new TenantService(tenantRepository);
const tenantController = new TenantController(tenantService);

const router = Router();

// Public/Testing routes (no auth required for MVP)
router.post('/', validateRequest(createTenantSchema), tenantController.create);
router.get('/', tenantController.getAll);
router.get('/:id', tenantController.getById);
router.put('/:id', validateRequest(updateTenantSchema), tenantController.update);
router.delete('/:id', tenantController.delete);

export default router;
