import express from 'express';
import dataRouter from '../data.js';
import {
  developerExtApiAuth,
  developerExtScopeGuard,
  developerExtRateLimit,
  developerExtUsageLifecycle,
} from '../../middleware/developerExtApi.js';
import { camelCaseJsonResponses } from '../../utils/caseConversion.js';
import sessionsFlightsRouter from './sessionsFlights.js';
import developerExtrasRouter from './developerExtras.js';

const router = express.Router();

router.use(camelCaseJsonResponses);
router.use(developerExtUsageLifecycle);
router.use(developerExtApiAuth);
router.use(developerExtRateLimit);
router.use(developerExtScopeGuard(1));
router.use(developerExtrasRouter);
router.use('/data', dataRouter);
router.use('/sessions', sessionsFlightsRouter);

export default router;
