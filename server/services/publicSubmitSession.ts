import { sql } from 'kysely';
import { mainDb } from '../db/connection.js';
import { getSessionById } from '../db/sessions.js';
import { parsePublicSessionAtis } from '../utils/publicSessionAtis.js';

export interface PublicSubmitSession {
  sessionId: string;
  airportIcao: string;
  activeRunway?: string;
  isPFATC?: boolean;
  isAdvancedATC?: boolean;
  feedbackEnabled?: boolean;
  createdBy: string;
  flightCount: number;
  atisLetter?: string;
  atisText?: string;
  controllerUsername?: string;
  externalSession?: boolean;
}

export async function getPublicSubmitSession(
  sessionId: string
): Promise<PublicSubmitSession | null> {
  const session = await getSessionById(sessionId);
  if (!session) return null;

  const [flightCountRow, controller] = await Promise.all([
    mainDb
      .selectFrom('flights')
      .select(sql`count(*)`.as('count'))
      .where('session_id', '=', session.session_id)
      .executeTakeFirst(),
    mainDb
      .selectFrom('users')
      .select(['username'])
      .where('id', '=', session.created_by)
      .executeTakeFirst(),
  ]);

  const flightCount = parseInt(flightCountRow?.count as string, 10) || 0;
  const { letter: atisLetter, text: atisText } = parsePublicSessionAtis(
    session.atis
  );

  return {
    sessionId: session.session_id,
    airportIcao: session.airport_icao,
    activeRunway: session.active_runway ?? undefined,
    isPFATC: session.is_pfatc,
    isAdvancedATC: session.is_advanced_atc,
    feedbackEnabled: session.feedback_enabled ?? true,
    createdBy: session.created_by,
    flightCount,
    atisLetter,
    atisText,
    controllerUsername: controller?.username ?? undefined,
    externalSession: session.external_session === true,
  };
}
