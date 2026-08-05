import express from 'express';
import dataRouter from '../data.js';
import {
  developerExtApiAuth,
  developerExtScopeGuard,
  developerExtRateLimit,
  developerExtUsageLifecycle,
} from '../../middleware/developerExtApi.js';
import sessionsFlightsRouter from './sessionsFlights.js';
import sessionsDeletionsRouter from './sessionsDeletions.js';
import developerExtrasRouter from './developerExtras.js';

const router = express.Router();

router.use(developerExtUsageLifecycle);
router.use(developerExtApiAuth);
router.use(developerExtRateLimit);
router.use(developerExtScopeGuard(2));
router.use(developerExtrasRouter);
router.use('/data', dataRouter);
router.use('/sessions', sessionsFlightsRouter);
router.use('/sessions', sessionsDeletionsRouter);

export default router;
