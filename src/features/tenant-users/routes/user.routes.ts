import { Router } from 'express';

import { PrismaService } from '../../../config/prisma.config';
import { validateRequest } from '../../../middleware/validation.middleware';
import { UserController } from '../controllers/user.controller';
import { UserRepository } from '../repositories/user.repository';
import { createUserSchema, updateUserSchema } from '../schemas/user.schema';
import { UserService } from '../services/user.service';

// Dependency Injection
const prismaService = PrismaService.getInstance();
const prisma = prismaService.client;
const userRepository = new UserRepository(prisma);
const userService = new UserService(userRepository);
const userController = new UserController(userService);

const router = Router({ mergeParams: true });

// User management routes for a tenant
router.post('/', validateRequest(createUserSchema), userController.create);
router.get('/', userController.getAll);
router.get('/:userId', userController.getById);
router.put('/:userId', validateRequest(updateUserSchema), userController.update);
router.delete('/:userId', userController.delete);

export default router;
