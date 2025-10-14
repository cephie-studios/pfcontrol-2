import { mainDb } from "./connection.js";
import { sql } from "kysely";

// Create indexes for performance
export async function createLogbookIndexes() {
  try {
    await mainDb.schema
      .createIndex('idx_logbook_user')
      .ifNotExists()
      .on('logbook_flights')
      .column('user_id')
      .execute();

    await mainDb.schema
      .createIndex('idx_logbook_roblox')
      .ifNotExists()
      .on('logbook_flights')
      .column('roblox_username')
      .execute();

    await mainDb.schema
      .createIndex('idx_logbook_status')
      .ifNotExists()
      .on('logbook_flights')
      .column('flight_status')
      .execute();

    await mainDb.schema
      .createIndex('idx_telemetry_flight')
      .ifNotExists()
      .on('logbook_telemetry')
      .columns(['flight_id', 'timestamp'])
      .execute();

    await mainDb.schema
      .createIndex('idx_active_flights_callsign')
      .ifNotExists()
      .on('logbook_active_flights')
      .column('callsign')
      .execute();

    console.log('Logbook indexes created successfully');
  } catch (error) {
    console.error('Error creating logbook indexes:', error);
  }
}

export async function createFlight({
  userId,
  robloxUserId,
  robloxUsername,
  callsign,
  departureIcao,
  arrivalIcao,
  route,
  aircraftIcao
}: {
  userId: string;
  robloxUserId?: string;
  robloxUsername: string;
  callsign: string;
  departureIcao?: string;
  arrivalIcao?: string;
  route?: string;
  aircraftIcao?: string;
}) {
  const crypto = await import('crypto');
  const shareToken = crypto.randomBytes(4).toString('hex');

  const result = await mainDb
    .insertInto('logbook_flights')
    .values({
      id: sql`DEFAULT`,
      user_id: userId,
      roblox_user_id: robloxUserId,
      roblox_username: robloxUsername,
      callsign,
      departure_icao: departureIcao,
      arrival_icao: arrivalIcao,
      route,
      aircraft_icao: aircraftIcao,
      flight_status: 'pending',
      logged_from_submit: true,
      share_token: shareToken,
      created_at: sql`NOW()`
    })
    .returning('id')
    .executeTakeFirst();

  return result?.id;
}

export async function startActiveFlightTracking(robloxUsername: string, callsign: string, flightId: number) {
  await mainDb
    .insertInto('logbook_active_flights')
    .values({
      id: sql`DEFAULT`,
      roblox_username: robloxUsername,
      callsign,
      flight_id: flightId,
      created_at: sql`NOW()`
    })
    .onConflict((oc) =>
      oc.column('roblox_username').doUpdateSet({
        callsign,
        flight_id: flightId,
        created_at: sql`NOW()`
      })
    )
    .execute();
}

export async function getActiveFlightByUsername(robloxUsername: string) {
  const result = await mainDb
    .selectFrom('logbook_active_flights')
    .selectAll()
    .where('roblox_username', '=', robloxUsername)
    .executeTakeFirst();

  return result || null;
}

export async function storeTelemetryPoint(
  flightId: number, 
  { x, y, altitude, speed, heading, timestamp, phase, verticalSpeed }: {
    x?: number;
    y?: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    timestamp: Date | string;
    phase?: string;
    verticalSpeed?: number;
  }
) {
  const utcTimestamp = timestamp instanceof Date ? timestamp : new Date(timestamp);

  await mainDb
    .insertInto('logbook_telemetry')
    .values({
      id: sql`DEFAULT`,
      flight_id: flightId,
      timestamp: utcTimestamp,
      x,
      y,
      altitude_ft: altitude,
      speed_kts: speed,
      heading,
      flight_phase: phase,
      vertical_speed_fpm: verticalSpeed ?? 0
    })
    .execute();
}

export async function updateActiveFlightState(
  robloxUsername: string,
  { altitude, speed, heading, x, y, phase }: {
    altitude?: number;
    speed?: number;
    heading?: number;
    x?: number;
    y?: number;
    phase?: string;
  }
) {
  await mainDb
    .updateTable('logbook_active_flights')
    .set({
      last_update: sql`NOW()`,
      last_altitude: altitude,
      last_speed: speed,
      last_heading: heading,
      last_x: x,
      last_y: y,
      current_phase: phase
    })
    .where('roblox_username', '=', robloxUsername)
    .execute();
}

export async function addApproachAltitude(robloxUsername: string, altitude: number, timestamp: Date) {
  await mainDb
    .updateTable('logbook_active_flights')
    .set({
      approach_altitudes: sql`array_append(COALESCE(approach_altitudes, ARRAY[]::INTEGER[]), ${altitude})`,
      approach_timestamps: sql`array_append(COALESCE(approach_timestamps, ARRAY[]::TIMESTAMP[]), ${timestamp})`
    })
    .where('roblox_username', '=', robloxUsername)
    .execute();

  // Keep only last 30 entries
  await mainDb
    .updateTable('logbook_active_flights')
    .set({
      approach_altitudes: sql`approach_altitudes[greatest(1, array_length(approach_altitudes, 1) - 29):]`,
      approach_timestamps: sql`approach_timestamps[greatest(1, array_length(approach_timestamps, 1) - 29):]`
    })
    .where('roblox_username', '=', robloxUsername)
    .execute();
}

export async function calculateLandingRate(robloxUsername: string): Promise<number | null> {
  const flightResult = await mainDb
    .selectFrom('logbook_active_flights as laf')
    .innerJoin('logbook_flights as lf', 'laf.flight_id', 'lf.id')
    .select(['laf.flight_id', 'lf.waypoint_landing_rate'])
    .where('laf.roblox_username', '=', robloxUsername)
    .executeTakeFirst();

  if (!flightResult) {
    return null;
  }

  const { flight_id: flightId, waypoint_landing_rate } = flightResult;

  if (waypoint_landing_rate !== null && waypoint_landing_rate !== undefined) {
    console.log(`[Landing Rate] Using waypoint data: ${waypoint_landing_rate} fpm`);
    return waypoint_landing_rate;
  }

  if (flightId === undefined) {
    return null;
  }
  const telemetryResult = await mainDb
    .selectFrom('logbook_telemetry')
    .select(['altitude_ft', 'vertical_speed_fpm', 'timestamp', 'flight_phase'])
    .where('flight_id', '=', flightId)
    .where('flight_phase', 'in', ['approach', 'landing'])
    .where('altitude_ft', '<', 100)
    .orderBy('altitude_ft', 'asc')
    .limit(1)
    .executeTakeFirst();

  if (!telemetryResult) {
    return null;
  }

  console.log(`[Landing Rate] Using telemetry data: ${telemetryResult.vertical_speed_fpm} fpm`);
  return telemetryResult.vertical_speed_fpm || null;
}

export async function finalizeFlight(flightId: number, stats: {
  durationMinutes: number;
  totalDistance: number;
  maxAltitude: number;
  maxSpeed: number;
  averageSpeed: number;
  landingRate: number | null;
  smoothnessScore: number;
  landingScore: number;
}) {
  await mainDb
    .updateTable('logbook_flights')
    .set({
      flight_end: sql`NOW()`,
      duration_minutes: stats.durationMinutes,
      total_distance_nm: stats.totalDistance,
      max_altitude_ft: stats.maxAltitude,
      max_speed_kts: stats.maxSpeed,
      average_speed_kts: stats.averageSpeed,
      landing_rate_fpm: stats.landingRate ?? undefined,
      smoothness_score: stats.smoothnessScore,
      landing_score: stats.landingScore,
      flight_status: 'completed'
    })
    .where('id', '=', flightId)
    .execute();
}

export async function removeActiveFlightTracking(robloxUsername: string) {
  await mainDb
    .deleteFrom('logbook_active_flights')
    .where('roblox_username', '=', robloxUsername)
    .execute();
}

export async function getActiveFlightByCallsign(callsign: string) {
  const result = await mainDb
    .selectFrom('logbook_active_flights as laf')
    .innerJoin('logbook_flights as lf', 'laf.flight_id', 'lf.id')
    .selectAll('laf')
    .select(['lf.id as flight_id', 'lf.user_id', 'lf.flight_status'])
    .where('laf.callsign', '=', callsign)
    .executeTakeFirst();

  return result || null;
}

export async function activateFlightByCallsign(callsign: string): Promise<number | null> {
  return await mainDb.transaction().execute(async (trx) => {
    const result = await trx
      .updateTable('logbook_flights as lf')
      .from('logbook_active_flights as laf')
      .set({
        flight_status: 'active',
        flight_start: sql`NOW()`,
        activated_at: sql`NOW()`,
        controller_managed: true
      })
      .where('laf.callsign', '=', callsign)
      .whereRef('laf.flight_id', '=', 'lf.id')
      .where('lf.flight_status', '=', 'pending')
      .returning('lf.id')
      .executeTakeFirst();

    return result?.id || null;
  });
}

export async function completeFlightByCallsign(callsign: string): Promise<number | null> {
  return await mainDb.transaction().execute(async (trx) => {
    // 1. Get flight and active data
    const flightResult = await trx
      .selectFrom('logbook_active_flights as laf')
      .innerJoin('logbook_flights as lf', 'laf.flight_id', 'lf.id')
      .selectAll('lf')
      .select([
        'laf.roblox_username',
        'laf.approach_altitudes',
        'laf.approach_timestamps'
      ])
      .where('laf.callsign', '=', callsign)
      .where('lf.flight_status', 'in', ['active', 'pending'])
      .executeTakeFirst();

    if (!flightResult) {
      // Try to log why
      const checkFlight = await trx
        .selectFrom('logbook_flights as lf')
        .leftJoin('logbook_active_flights as laf', 'laf.flight_id', 'lf.id')
        .select([
          'lf.flight_status',
          'lf.callsign',
          'laf.callsign as active_callsign'
        ])
        .where('lf.callsign', '=', callsign)
        .executeTakeFirst();

      if (checkFlight) {
        console.error(`[Logbook] Cannot complete ${callsign}: flight_status="${checkFlight.flight_status}", in_active_table=${!!checkFlight.active_callsign}`);
      } else {
        console.error(`[Logbook] Cannot complete ${callsign}: flight not found in logbook`);
      }
      return null;
    }

    // 2. Telemetry stats
    const stats = await trx
      .selectFrom('logbook_telemetry')
      .select(({ fn }) => [
        fn.max('altitude_ft').as('max_altitude'),
        fn.max('speed_kts').as('max_speed'),
        fn.avg(sql`CASE WHEN speed_kts > 10 THEN speed_kts ELSE NULL END`).as('avg_speed'),
        fn.countAll().as('telemetry_count'),
        fn.min('timestamp').as('first_telemetry'),
        fn.max('timestamp').as('last_telemetry')
      ])
      .where('flight_id', '=', flightResult.id)
      .executeTakeFirst();

    // 3. Calculate total distance
    const telemetryPoints = await trx
      .selectFrom('logbook_telemetry')
      .select(['x', 'y', 'timestamp'])
      .where('flight_id', '=', flightResult.id)
      .orderBy('timestamp', 'asc')
      .execute();

    let totalDistance = 0;
    for (let i = 1; i < telemetryPoints.length; i++) {
      const prev = telemetryPoints[i - 1];
      const curr = telemetryPoints[i];
      if (prev.x != null && prev.y != null && curr.x != null && curr.y != null) {
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const distance = Math.sqrt(dx * dx + dy * dy) / 1852;
        totalDistance += distance;
      }
    }

    // 4. Duration
    const now = new Date();
    const startTime = flightResult.flight_start ?? flightResult.created_at ?? null;
    const durationMinutes = startTime
      ? Math.round((now.getTime() - new Date(startTime as string | number | Date).getTime()) / 60000)
      : 0;

    // 5. Landing rate from approach altitudes
    let landingRate: number | null = null;
    if (
      Array.isArray(flightResult.approach_altitudes) &&
      flightResult.approach_altitudes.length >= 2 &&
      Array.isArray(flightResult.approach_timestamps) &&
      flightResult.approach_timestamps.length >= 2
    ) {
      const altitudes = flightResult.approach_altitudes;
      const timestamps = flightResult.approach_timestamps;
      const firstAlt = altitudes[0];
      const lastAlt = altitudes[altitudes.length - 1];
      const firstTime = new Date(timestamps[0] as string | number | Date);
      const lastTime = new Date(timestamps[timestamps.length - 1] as string | number | Date);
      const altChange = firstAlt - lastAlt;
      const timeChange = (lastTime.getTime() - firstTime.getTime()) / 1000;
      if (timeChange > 0) {
        const feetPerSecond = altChange / timeChange;
        landingRate = -Math.round(feetPerSecond * 60);
      }
    }

    // 6. Landing score
    let landingScore: number | null = null;
    if (landingRate !== null) {
      const absLandingRate = Math.abs(landingRate);
      if (absLandingRate <= 100) landingScore = 100;
      else if (absLandingRate <= 200) landingScore = 90;
      else if (absLandingRate <= 300) landingScore = 80;
      else if (absLandingRate <= 400) landingScore = 70;
      else if (absLandingRate <= 500) landingScore = 60;
      else if (absLandingRate <= 600) landingScore = 50;
      else if (absLandingRate <= 700) landingScore = 40;
      else if (absLandingRate <= 800) landingScore = 30;
      else landingScore = 20;
    }

    // 7. Smoothness score
    let smoothnessScore: number | null = null;
    const telemetryData = await trx
      .selectFrom('logbook_telemetry')
      .select(['speed_kts', 'vertical_speed_fpm', 'heading'])
      .where('flight_id', '=', flightResult.id)
      .orderBy('timestamp', 'asc')
      .execute();

    if (telemetryData.length > 2) {
      let score = 100;
      let speedPenalty = 0;
      let verticalSpeedPenalty = 0;
      let headingPenalty = 0;
      let validComparisons = 0;

      for (let i = 1; i < telemetryData.length; i++) {
        const prev = telemetryData[i - 1];
        const curr = telemetryData[i];
        validComparisons++;

        if (prev.speed_kts != null && curr.speed_kts != null) {
          const speedChange = Math.abs(curr.speed_kts - prev.speed_kts);
          if (speedChange > 30) speedPenalty += 3;
          else if (speedChange > 20) speedPenalty += 2;
          else if (speedChange > 10) speedPenalty += 1;
        }

        if (prev.vertical_speed_fpm != null && curr.vertical_speed_fpm != null) {
          const vsChange = Math.abs(curr.vertical_speed_fpm - prev.vertical_speed_fpm);
          if (vsChange > 500) verticalSpeedPenalty += 3;
          else if (vsChange > 300) verticalSpeedPenalty += 2;
          else if (vsChange > 150) verticalSpeedPenalty += 1;
        }

        if (prev.heading != null && curr.heading != null) {
          let headingChange = Math.abs(curr.heading - prev.heading);
          if (headingChange > 180) headingChange = 360 - headingChange;

          if (headingChange > 30) headingPenalty += 2;
          else if (headingChange > 20) headingPenalty += 1;
        }
      }

      if (validComparisons > 0) {
        const totalPenalty = (speedPenalty * 0.4) + (verticalSpeedPenalty * 0.4) + (headingPenalty * 0.2);
        const avgPenalty = totalPenalty / validComparisons;
        score = 100 - Math.min(avgPenalty * 10, 100);
      }

      smoothnessScore = Math.max(0, Math.min(100, Math.round(score)));
    }

    // 8. Update logbook_flights
    await trx
      .updateTable('logbook_flights')
      .set({
        flight_end: sql`NOW()`,
        duration_minutes: durationMinutes,
        total_distance_nm: Math.round(totalDistance * 100) / 100,
        max_altitude_ft: stats?.max_altitude ?? 0,
        max_speed_kts: stats?.max_speed ?? 0,
        average_speed_kts: stats?.avg_speed ? Math.round(Number(stats.avg_speed)) : 0,
        landing_rate_fpm: landingRate ?? undefined,
        smoothness_score: smoothnessScore ?? undefined,
        landing_score: landingScore ?? undefined,
        flight_status: 'completed',
        controller_managed: true
      })
      .where('id', '=', flightResult.id)
      .execute();

    // 9. Remove from active flights
    await trx
      .deleteFrom('logbook_active_flights')
      .where('callsign', '=', callsign)
      .execute();

    // 10. Update stats cache (non-blocking)
    setTimeout(() => {
      updateUserStatsCache(flightResult.user_id).catch(console.error);
    }, 100);

    return flightResult.id;
  });
}

export async function getUserFlights(
  userId: string,
  page: number = 1,
  limit: number = 20,
  status: string = 'completed'
) {
  const offset = (page - 1) * limit;
  const useCreatedAt = (status === 'pending' || status === 'active');
  const orderByColumn = useCreatedAt ? 'lf.created_at' : sql`COALESCE(lf.flight_start, lf.created_at)`;

  const flights = await mainDb
    .selectFrom('logbook_flights as lf')
    .leftJoin('logbook_active_flights as laf', 'laf.flight_id', 'lf.id')
    .selectAll('lf')
    .select('laf.current_phase')
    .where('lf.user_id', '=', userId)
    .where('lf.flight_status', '=', status)
    .orderBy(orderByColumn, 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  const countResult = await mainDb
    .selectFrom('logbook_flights')
    .select(({ fn }) => [fn.countAll().as('count')])
    .where('user_id', '=', userId)
    .where('flight_status', '=', status)
    .executeTakeFirst();

  const total = Number(countResult?.count ?? 0);

  return {
    flights,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit)
    }
  };
}

export async function getFlightById(flightId: number) {
  const result = await mainDb
    .selectFrom('logbook_flights')
    .selectAll()
    .where('id', '=', flightId)
    .executeTakeFirst();

  return result || null;
}

export async function getActiveFlightData(flightId: number) {
  const flight = await getFlightById(flightId);
  if (!flight) return null;

  if (flight.flight_status !== 'active' && flight.flight_status !== 'pending') {
    return flight;
  }

  const activeResult = await mainDb
    .selectFrom('logbook_active_flights')
    .selectAll()
    .where('flight_id', '=', flightId)
    .executeTakeFirst();

  const statsResult = await mainDb
    .selectFrom('logbook_telemetry')
    .select(({ fn }) => [
      fn.countAll().as('telemetry_count'),
      fn.max('altitude_ft').as('max_altitude_ft'),
      fn.max('speed_kts').as('max_speed_kts'),
      fn.avg(sql`CASE WHEN altitude_ft > 100 THEN speed_kts ELSE NULL END`).as('avg_speed_kts')
    ])
    .where('flight_id', '=', flightId)
    .executeTakeFirst();

  // Calculate distance using window function
  const distanceResult = await mainDb
    .selectFrom((eb) => 
      eb.selectFrom('logbook_telemetry')
        .select([
          'x', 'y', 'timestamp',
          sql`LAG(x) OVER (ORDER BY timestamp)`.as('prev_x'),
          sql`LAG(y) OVER (ORDER BY timestamp)`.as('prev_y')
        ])
        .where('flight_id', '=', flightId)
        .orderBy('timestamp', 'asc')
        .as('telemetry_points')
    )
    .select(
      sql<number>`SUM(
        CASE
          WHEN prev_x IS NOT NULL AND prev_y IS NOT NULL
          THEN SQRT(POWER(x - prev_x, 2) + POWER(y - prev_y, 2)) / 1852
          ELSE 0
        END
      )`.as('total_distance')
    )
    .executeTakeFirst();

  const totalDistanceNm = distanceResult?.total_distance ? 
    Math.round(distanceResult.total_distance) : null;

  // Calculate smoothness score
  const telemetryResult = await mainDb
    .selectFrom('logbook_telemetry')
    .select(['speed_kts', 'altitude_ft'])
    .where('flight_id', '=', flightId)
    .orderBy('timestamp', 'asc')
    .execute();

  let smoothnessScore = null;
  if (telemetryResult.length > 1) {
    let score = 100;
    for (let i = 1; i < telemetryResult.length; i++) {
      const speedDelta = Math.abs((telemetryResult[i].speed_kts || 0) - (telemetryResult[i - 1].speed_kts || 0));
      const altDelta = Math.abs((telemetryResult[i].altitude_ft || 0) - (telemetryResult[i - 1].altitude_ft || 0));

      if (speedDelta > 20) score -= 2;
      if (altDelta > 500) score -= 3;
    }
    smoothnessScore = Math.max(0, Math.min(100, score));
  }

  // Get landing rate if landed
  let landingRate = null;
  if (activeResult?.landing_detected && activeResult?.roblox_username) {
    landingRate = await calculateLandingRate(activeResult.roblox_username);
  }

  const durationMs = new Date().getTime() - new Date(flight.created_at!).getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  return {
    ...flight,
    current_altitude: activeResult?.last_altitude || null,
    current_speed: activeResult?.last_speed || null,
    current_heading: activeResult?.last_heading || null,
    current_phase: activeResult?.current_phase || null,
    last_update: activeResult?.last_update || null,
    landing_detected: activeResult?.landing_detected || false,
    stationary_notification_sent: activeResult?.stationary_notification_sent || false,
    duration_minutes: durationMinutes,
    max_altitude_ft: statsResult?.max_altitude_ft || null,
    max_speed_kts: statsResult?.max_speed_kts || null,
    average_speed_kts: statsResult?.avg_speed_kts ? Math.round(Number(statsResult.avg_speed_kts)) : null,
    total_distance_nm: totalDistanceNm,
    smoothness_score: smoothnessScore,
    landing_rate_fpm: landingRate,
    telemetry_count: Number(statsResult?.telemetry_count) || 0,
    is_active: true
  };
}

export async function getFlightTelemetry(flightId: number) {
  const result = await mainDb
    .selectFrom('logbook_telemetry')
    .selectAll()
    .where('flight_id', '=', flightId)
    .orderBy('timestamp', 'asc')
    .execute();

  return result;
}

export async function getUserStats(userId: string) {
  let result = await mainDb
    .selectFrom('logbook_stats_cache')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!result) {
    await mainDb
      .insertInto('logbook_stats_cache')
      .values({ user_id: userId })
      .execute();

    result = await mainDb
      .selectFrom('logbook_stats_cache')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
  }

  return result;
}

export async function generateShareToken(flightId: number, userId: string): Promise<string> {
  const flight = await mainDb
    .selectFrom('logbook_flights')
    .select(['share_token', 'user_id'])
    .where('id', '=', flightId)
    .executeTakeFirst();

  if (!flight) {
    throw new Error('Flight not found');
  }

  if (flight.user_id !== userId) {
    throw new Error('Not authorized');
  }

  if (flight.share_token) {
    return flight.share_token;
  }

  const crypto = await import('crypto');
  const shareToken = crypto.randomBytes(4).toString('hex');

  await mainDb
    .updateTable('logbook_flights')
    .set({ share_token: shareToken })
    .where('id', '=', flightId)
    .execute();

  return shareToken;
}

export async function getFlightByShareToken(shareToken: string) {
  const result = await mainDb
    .selectFrom('logbook_flights as f')
    .leftJoin('users as u', 'f.user_id', 'u.id')
    .selectAll('f')
    .select(['u.username as discord_username', 'u.discriminator as discord_discriminator'])
    .where('f.share_token', '=', shareToken)
    .executeTakeFirst();

  if (!result) {
    return null;
  }

  if (result.flight_status === 'active' || result.flight_status === 'pending') {
    const activeData = await getActiveFlightData(result.id);
    return {
      ...activeData,
      discord_username: result.discord_username,
      discord_discriminator: result.discord_discriminator
    };
  }

  return result;
}

export async function getPublicPilotProfile(username: string) {
  const userResult = await mainDb
    .selectFrom('users as u')
    .select([
      'u.id', 'u.username', 'u.discriminator', 'u.avatar',
      'u.roblox_username', 'u.roblox_user_id', 'u.vatsim_cid',
      'u.vatsim_rating_id', 'u.vatsim_rating_short', 'u.vatsim_rating_long',
      'u.created_at'
    ])
    .where(sql`LOWER(u.username)`, '=', username.toLowerCase())
    .executeTakeFirst();

  if (!userResult) {
    return null;
  }

  // Handle VATSIM rating fallback
  let vatsimShort = userResult.vatsim_rating_short;
  if (!vatsimShort && userResult.vatsim_rating_id) {
    const ratingId = Number(userResult.vatsim_rating_id);
    const ratingMap: Record<number, string> = {
      0: 'OBS', 1: 'S1', 2: 'S2', 3: 'S3', 4: 'C1', 5: 'C2', 
      6: 'C3', 7: 'I1', 8: 'I2', 9: 'I3', 10: 'SUP', 11: 'ADM'
    };
    vatsimShort = ratingMap[ratingId] || undefined;
  }

  const rolesResult = await mainDb
    .selectFrom('roles as r')
    .innerJoin('user_roles as ur', 'ur.role_id', 'r.id')
    .select(['r.id', 'r.name', 'r.description', 'r.color', 'r.icon', 'r.priority'])
    .where('ur.user_id', '=', userResult.id)
    .orderBy('r.priority', 'desc')
    .orderBy('r.created_at', 'desc')
    .execute();

  const stats = await getUserStats(userResult.id);

  const recentFlights = await mainDb
    .selectFrom('logbook_flights')
    .select([
      'id', 'callsign', 'aircraft_model', 'aircraft_icao',
      'departure_icao', 'arrival_icao', 'duration_minutes',
      'total_distance_nm', 'landing_rate_fpm', 'created_at', 'flight_end'
    ])
    .where('user_id', '=', userResult.id)
    .where('flight_status', '=', 'completed')
    .orderBy('flight_end', 'desc')
    .limit(10)
    .execute();

  const activityData = await mainDb
    .selectFrom('logbook_flights')
    .select([
      sql`DATE_TRUNC('month', flight_end)`.as('month'),
      mainDb.fn.countAll().as('flight_count'),
      mainDb.fn.sum('duration_minutes').as('total_minutes')
    ])
    .where('user_id', '=', userResult.id)
    .where('flight_status', '=', 'completed')
    .where('flight_end', '>=', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
    .groupBy(sql`DATE_TRUNC('month', flight_end)`)
    .orderBy('month', 'desc')
    .execute();

  return {
    user: {
      ...userResult,
      vatsim_rating_short: vatsimShort,
      member_since: userResult.created_at,
      roles: rolesResult,
      role_name: rolesResult[0]?.name || null,
      role_description: rolesResult[0]?.description || null
    },
    stats,
    recentFlights,
    activityData
  };
}

export async function updateUserStatsCache(userId: string) {
  const totals = await mainDb
    .selectFrom('logbook_flights')
    .select(({ fn }) => [
      fn.countAll().as('total_flights'),
      fn.sum(sql`CASE WHEN duration_minutes > 0 THEN duration_minutes ELSE 0 END`).as('total_minutes'),
      sql<number>`COALESCE(SUM(CASE WHEN duration_minutes > 0 THEN duration_minutes ELSE 0 END) / 60.0, 0)`.as('total_hours'),
      fn.sum('total_distance_nm').as('total_distance')
    ])
    .where('user_id', '=', userId)
    .where('flight_status', '=', 'completed')
    .executeTakeFirst();

  const favAircraft = await mainDb
    .selectFrom('logbook_flights')
    .select(['aircraft_model', ({ fn }) => fn.countAll().as('count')])
    .where('user_id', '=', userId)
    .where('flight_status', '=', 'completed')
    .where('aircraft_model', 'is not', null)
    .groupBy('aircraft_model')
    .orderBy('count', 'desc')
    .limit(1)
    .executeTakeFirst();

  const favDeparture = await mainDb
    .selectFrom('logbook_flights')
    .select(['departure_icao', ({ fn }) => fn.countAll().as('count')])
    .where('user_id', '=', userId)
    .where('flight_status', '=', 'completed')
    .where('departure_icao', 'is not', null)
    .groupBy('departure_icao')
    .orderBy('count', 'desc')
    .limit(1)
    .executeTakeFirst();

  const smoothestLanding = await mainDb
    .selectFrom('logbook_flights')
    .select(['id', 'landing_rate_fpm'])
    .where('user_id', '=', userId)
    .where('flight_status', '=', 'completed')
    .where('landing_rate_fpm', 'is not', null)
    .orderBy(sql`ABS(landing_rate_fpm)`, 'asc')
    .limit(1)
    .executeTakeFirst();

  const avgLandingScore = await mainDb
    .selectFrom('logbook_flights')
    .select(({ fn }) => fn.avg('landing_score').as('avg_score'))
    .where('user_id', '=', userId)
    .where('flight_status', '=', 'completed')
    .where('landing_score', 'is not', null)
    .executeTakeFirst();

  const highestAlt = await mainDb
    .selectFrom('logbook_flights')
    .select(({ fn }) => fn.max('max_altitude_ft').as('highest_altitude'))
    .where('user_id', '=', userId)
    .where('flight_status', '=', 'completed')
    .executeTakeFirst();

  const longestFlight = await mainDb
    .selectFrom('logbook_flights')
    .select(['id', 'total_distance_nm'])
    .where('user_id', '=', userId)
    .where('flight_status', '=', 'completed')
    .orderBy('total_distance_nm', 'desc')
    .limit(1)
    .executeTakeFirst();

  await mainDb
    .updateTable('logbook_stats_cache')
    .set({
      total_flights: Number(totals?.total_flights) || 0,
      total_hours: Number(totals?.total_hours) || 0,
      total_flight_time_minutes: Number(totals?.total_minutes) || 0,
      total_distance_nm: Number(totals?.total_distance) || 0,
      favorite_aircraft: favAircraft?.aircraft_model ?? undefined,
      favorite_aircraft_count: Number(favAircraft?.count) || 0,
      favorite_departure: favDeparture?.departure_icao ?? undefined,
      favorite_departure_count: Number(favDeparture?.count) || 0,
      smoothest_landing_rate: smoothestLanding?.landing_rate_fpm ?? undefined,
      smoothest_landing_flight_id: smoothestLanding?.id ?? undefined,
      best_landing_rate: smoothestLanding?.landing_rate_fpm ?? undefined,
      average_landing_score: avgLandingScore?.avg_score ? Number(avgLandingScore.avg_score) : undefined,
      highest_altitude: highestAlt?.highest_altitude ?? undefined,
      longest_flight_distance: longestFlight?.total_distance_nm ? Number(longestFlight.total_distance_nm) : undefined,
      longest_flight_id: longestFlight?.id ?? undefined,
      last_updated: sql`NOW()`
    })
    .where('user_id', '=', userId)
    .execute();
}

export async function deleteFlightById(flightId: number, userId: string, isAdmin: boolean = false) {
  return await mainDb.transaction().execute(async (trx) => {
    const flightCheck = await trx
      .selectFrom('logbook_flights')
      .select(['id', 'user_id', 'flight_status'])
      .where('id', '=', flightId)
      .executeTakeFirst();

    if (!flightCheck) {
      return { success: false, error: 'Flight not found' };
    }

    if (flightCheck.user_id !== userId && !isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    if (!isAdmin && flightCheck.flight_status !== 'pending') {
      return { success: false, error: 'Can only delete pending flights' };
    }

    // Delete related data
    await trx
      .deleteFrom('logbook_active_flights')
      .where('flight_id', '=', flightId)
      .execute();

    await trx
      .deleteFrom('logbook_telemetry')
      .where('flight_id', '=', flightId)
      .execute();

    await trx
      .deleteFrom('logbook_flights')
      .where('id', '=', flightId)
      .execute();

    // Update stats cache if completed flight
    if (flightCheck.flight_status === 'completed') {
      setTimeout(() => {
        updateUserStatsCache(flightCheck.user_id).catch(console.error);
      }, 100);
    }

    return { success: true };
  });
}

type Waypoint = {
  timestamp: number;
  landing_speed: number;
  runway?: string;
  airport?: string;
  [key: string]: unknown;
};

export async function storeWaypoint(robloxUsername: string, waypointData: Waypoint) {
  const result = await mainDb
    .selectFrom('logbook_active_flights')
    .select('collected_waypoints')
    .where('roblox_username', '=', robloxUsername)
    .executeTakeFirst();

  if (!result) {
    console.warn(`[Waypoint] No active flight found for ${robloxUsername}`);
    return;
  }

  const existingWaypoints: Waypoint[] = Array.isArray(result.collected_waypoints) ? result.collected_waypoints : [];
  const updatedWaypoints = [...existingWaypoints, waypointData];

  await mainDb
    .updateTable('logbook_active_flights')
    .set({ collected_waypoints: updatedWaypoints })
    .where('roblox_username', '=', robloxUsername)
    .execute();
}

export async function finalizeLandingFromWaypoints(robloxUsername: string) {
  const result = await mainDb
    .selectFrom('logbook_active_flights')
    .select(['collected_waypoints', 'flight_id'])
    .where('roblox_username', '=', robloxUsername)
    .executeTakeFirst();

  if (!result || !result.collected_waypoints) {
    console.log(`[Waypoint] No waypoints collected for ${robloxUsername}`);
    return null;
  }

  const waypoints = result.collected_waypoints as Waypoint[];
  if (waypoints.length === 0) {
    return null;
  }

  const timestamps = waypoints.map(w => w.timestamp);
  const maxTimestamp = Math.max(...timestamps);

  const recentCluster = waypoints.filter(w => {
    const timeDiff = maxTimestamp - w.timestamp;
    return timeDiff <= 90;
  });

  if (recentCluster.length === 0) {
    return null;
  }

  const selectedWaypoint = recentCluster.reduce((hardest, current) => {
    const hardestRate = Math.abs(hardest.landing_speed);
    const currentRate = Math.abs(current.landing_speed);
    return currentRate > hardestRate ? current : hardest;
  });

  await mainDb
    .updateTable('logbook_flights')
    .set({
      waypoint_landing_rate: Math.round(selectedWaypoint.landing_speed),
      landed_runway: selectedWaypoint.runway,
      landed_airport: selectedWaypoint.airport
    })
    .where('id', '=', result.flight_id!)
    .execute();

  return selectedWaypoint;
}

createLogbookIndexes().catch(console.error);