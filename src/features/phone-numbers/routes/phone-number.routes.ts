import { Router } from 'express';

import { PrismaService } from '../../../config/prisma.config';
import { validateRequest } from '../../../middleware/validation.middleware';
import { PhoneNumberController } from '../controllers/phone-number.controller';
import { PhoneNumberRepository } from '../repositories/phone-number.repository';
import { PhoneNumberService } from '../services/phone-number.service';
import { createPhoneNumberSchema, updatePhoneNumberSchema } from '../schemas/phone-number.schema';

// Dependency Injection
const prismaService = PrismaService.getInstance();
const prisma = prismaService.client;
const phoneNumberRepository = new PhoneNumberRepository(prisma);
const phoneNumberService = new PhoneNumberService(phoneNumberRepository);
const phoneNumberController = new PhoneNumberController(phoneNumberService);

const router = Router({ mergeParams: true });

// Phone number routes for a tenant
router.post('/', validateRequest(createPhoneNumberSchema), phoneNumberController.create);
router.get('/', phoneNumberController.getAll);
router.get('/:phoneNumberId', phoneNumberController.getById);
router.put(
  '/:phoneNumberId',
  validateRequest(updatePhoneNumberSchema),
  phoneNumberController.update,
);
router.delete('/:phoneNumberId', phoneNumberController.delete);

export default router;
