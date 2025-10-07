import pool from './connections/connection.js';

// Initialize all logbook tables
export async function initializeLogbookTables() {
    try {
        // Main flights table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS logbook_flights (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                roblox_user_id VARCHAR(50),
                roblox_username VARCHAR(50) NOT NULL,

                -- Flight Info
                callsign VARCHAR(20) NOT NULL,
                aircraft_model VARCHAR(50),
                aircraft_icao VARCHAR(10),
                livery VARCHAR(100),

                -- Route
                departure_icao VARCHAR(4),
                arrival_icao VARCHAR(4),
                route TEXT,

                -- Timestamps
                flight_start TIMESTAMP,
                flight_end TIMESTAMP,
                duration_minutes INTEGER,

                -- Stats
                total_distance_nm DECIMAL(10,2),
                max_altitude_ft INTEGER,
                max_speed_kts INTEGER,
                average_speed_kts INTEGER,
                landing_rate_fpm INTEGER,
                landing_g_force DECIMAL(4,2),

                -- Quality Scores (0-100)
                smoothness_score INTEGER,
                landing_score INTEGER,
                route_adherence_score INTEGER,

                -- State (pending -> active -> completed/cancelled/aborted)
                flight_status VARCHAR(20) DEFAULT 'pending',
                controller_status VARCHAR(50),
                logged_from_submit BOOLEAN DEFAULT false,
                controller_managed BOOLEAN DEFAULT false,

                -- Parking/Gate Detection
                departure_position_x DOUBLE PRECISION,
                departure_position_y DOUBLE PRECISION,
                arrival_position_x DOUBLE PRECISION,
                arrival_position_y DOUBLE PRECISION,

                -- State change timestamps
                activated_at TIMESTAMP,
                landed_at TIMESTAMP,

                -- Landing waypoint data (from Project Flight API)
                landed_runway VARCHAR(10),
                landed_airport VARCHAR(4),
                waypoint_landing_rate INTEGER,

                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Telemetry table for time-series data
        await pool.query(`
            CREATE TABLE IF NOT EXISTS logbook_telemetry (
                id SERIAL PRIMARY KEY,
                flight_id INTEGER REFERENCES logbook_flights(id) ON DELETE CASCADE,

                -- Position
                timestamp TIMESTAMP NOT NULL,
                x DOUBLE PRECISION,
                y DOUBLE PRECISION,
                latitude DECIMAL(10,6),
                longitude DECIMAL(10,6),

                -- Flight Data
                altitude_ft INTEGER,
                speed_kts INTEGER,
                heading INTEGER,
                vertical_speed_fpm INTEGER,

                -- Phase
                flight_phase VARCHAR(20)
            )
        `);

        // Active flights tracking table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS logbook_active_flights (
                id SERIAL PRIMARY KEY,
                roblox_username VARCHAR(50) UNIQUE NOT NULL,
                callsign VARCHAR(20),
                flight_id INTEGER REFERENCES logbook_flights(id),

                -- Current state
                last_update TIMESTAMP,
                last_altitude INTEGER,
                last_speed INTEGER,
                last_heading INTEGER,
                last_x DOUBLE PRECISION,
                last_y DOUBLE PRECISION,

                -- Flight phase tracking
                current_phase VARCHAR(20),
                takeoff_detected BOOLEAN DEFAULT false,
                landing_detected BOOLEAN DEFAULT false,

                -- Departure detection
                initial_position_x DOUBLE PRECISION,
                initial_position_y DOUBLE PRECISION,
                initial_position_time TIMESTAMP,
                movement_started BOOLEAN DEFAULT false,
                movement_start_time TIMESTAMP,

                -- Arrival detection
                stationary_since TIMESTAMP,
                stationary_position_x DOUBLE PRECISION,
                stationary_position_y DOUBLE PRECISION,

                -- For landing rate calculation
                approach_altitudes INTEGER[],
                approach_timestamps TIMESTAMP[],

                -- Waypoint data collection (from Project Flight username WebSocket)
                collected_waypoints JSONB,

                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Stats cache table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS logbook_stats_cache (
                user_id VARCHAR(20) PRIMARY KEY,

                -- Totals
                total_flights INTEGER DEFAULT 0,
                total_hours DECIMAL(10,2) DEFAULT 0,
                total_flight_time_minutes INTEGER DEFAULT 0,
                total_distance_nm DECIMAL(10,2) DEFAULT 0,

                -- Favorites
                favorite_aircraft VARCHAR(50),
                favorite_aircraft_count INTEGER,
                favorite_airline VARCHAR(10),
                favorite_airline_count INTEGER,
                favorite_departure VARCHAR(4),
                favorite_departure_count INTEGER,

                -- Records
                smoothest_landing_rate INTEGER,
                smoothest_landing_flight_id INTEGER,
                best_landing_rate INTEGER,
                average_landing_score DECIMAL(5,2),
                highest_altitude INTEGER,
                longest_flight_distance DECIMAL(10,2),
                longest_flight_id INTEGER,

                last_updated TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_logbook_user ON logbook_flights(user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_logbook_roblox ON logbook_flights(roblox_username)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_logbook_status ON logbook_flights(flight_status)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_telemetry_flight ON logbook_telemetry(flight_id, timestamp)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_active_flights_callsign ON logbook_active_flights(callsign)`);

        // Add missing columns if they don't exist (migration)
        const columnsToAdd = [
            { name: 'controller_managed', type: 'BOOLEAN DEFAULT false' },
            { name: 'activated_at', type: 'TIMESTAMP' },
            { name: 'landed_at', type: 'TIMESTAMP' },
            { name: 'controller_status', type: 'VARCHAR(50)' }
        ];

        for (const col of columnsToAdd) {
            const columnCheck = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'logbook_flights'
                AND column_name = $1
            `, [col.name]);

            if (columnCheck.rows.length === 0) {
                await pool.query(`
                    ALTER TABLE logbook_flights
                    ADD COLUMN ${col.name} ${col.type}
                `);
                console.log('\x1b[33m%s\x1b[0m', `Added ${col.name} column to logbook_flights`);
            }
        }

        // Add missing columns to logbook_active_flights (migration)
        const activeFlightColumnsToAdd = [
            { name: 'initial_position_x', type: 'DOUBLE PRECISION' },
            { name: 'initial_position_y', type: 'DOUBLE PRECISION' },
            { name: 'initial_position_time', type: 'TIMESTAMP' },
            { name: 'movement_started', type: 'BOOLEAN DEFAULT false' },
            { name: 'movement_start_time', type: 'TIMESTAMP' },
            { name: 'stationary_since', type: 'TIMESTAMP' },
            { name: 'stationary_position_x', type: 'DOUBLE PRECISION' },
            { name: 'stationary_position_y', type: 'DOUBLE PRECISION' }
        ];

        for (const col of activeFlightColumnsToAdd) {
            const columnCheck = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'logbook_active_flights'
                AND column_name = $1
            `, [col.name]);

            if (columnCheck.rows.length === 0) {
                await pool.query(`
                    ALTER TABLE logbook_active_flights
                    ADD COLUMN ${col.name} ${col.type}
                `);
                console.log('\x1b[33m%s\x1b[0m', `Added ${col.name} column to logbook_active_flights`);
            }
        }

        // Add missing columns to logbook_stats_cache (migration)
        const statsCacheColumnsToAdd = [
            { name: 'total_flight_time_minutes', type: 'INTEGER DEFAULT 0' },
            { name: 'favorite_departure', type: 'VARCHAR(4)' },
            { name: 'favorite_departure_count', type: 'INTEGER' },
            { name: 'best_landing_rate', type: 'INTEGER' },
            { name: 'average_landing_score', type: 'DECIMAL(5,2)' }
        ];

        for (const col of statsCacheColumnsToAdd) {
            const columnCheck = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'logbook_stats_cache'
                AND column_name = $1
            `, [col.name]);

            if (columnCheck.rows.length === 0) {
                await pool.query(`
                    ALTER TABLE logbook_stats_cache
                    ADD COLUMN ${col.name} ${col.type}
                `);
                console.log('\x1b[33m%s\x1b[0m', `Added ${col.name} column to logbook_stats_cache`);
            }
        }

        console.log('\x1b[34m%s\x1b[0m', 'Logbook tables initialized');
    } catch (error) {
        console.error('Error initializing logbook tables:', error);
    }
}

// Create a new flight entry
export async function createFlight({ userId, robloxUserId, robloxUsername, callsign, departureIcao, arrivalIcao, route, aircraftIcao }) {
    const result = await pool.query(`
        INSERT INTO logbook_flights (
            user_id, roblox_user_id, roblox_username, callsign,
            departure_icao, arrival_icao, route, aircraft_icao,
            flight_status, logged_from_submit
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', true)
        RETURNING id
    `, [userId, robloxUserId, robloxUsername, callsign, departureIcao, arrivalIcao, route, aircraftIcao]);

    return result.rows[0].id;
}

// Start tracking an active flight
export async function startActiveFlightTracking(robloxUsername, callsign, flightId) {
    await pool.query(`
        INSERT INTO logbook_active_flights (roblox_username, callsign, flight_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (roblox_username)
        DO UPDATE SET callsign = $2, flight_id = $3, created_at = NOW()
    `, [robloxUsername, callsign, flightId]);
}

// Get active flight by Roblox username
export async function getActiveFlightByUsername(robloxUsername) {
    const result = await pool.query(`
        SELECT * FROM logbook_active_flights
        WHERE roblox_username = $1
    `, [robloxUsername]);

    return result.rows[0] || null;
}

// Store telemetry point
export async function storeTelemetryPoint(flightId, { x, y, altitude, speed, heading, timestamp, phase, verticalSpeed }) {
    await pool.query(`
        INSERT INTO logbook_telemetry (
            flight_id, timestamp, x, y, altitude_ft, speed_kts, heading, flight_phase, vertical_speed_fpm
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [flightId, timestamp, x, y, altitude, speed, heading, phase, verticalSpeed ?? 0]);
}

// Update active flight state
export async function updateActiveFlightState(robloxUsername, { altitude, speed, heading, x, y, phase }) {
    await pool.query(`
        UPDATE logbook_active_flights
        SET last_update = NOW(),
            last_altitude = $2,
            last_speed = $3,
            last_heading = $4,
            last_x = $5,
            last_y = $6,
            current_phase = $7
        WHERE roblox_username = $1
    `, [robloxUsername, altitude, speed, heading, x, y, phase]);
}

// Add altitude reading to approach array
export async function addApproachAltitude(robloxUsername, altitude, timestamp) {
    await pool.query(`
        UPDATE logbook_active_flights
        SET approach_altitudes = array_append(
                COALESCE(approach_altitudes, ARRAY[]::INTEGER[]),
                $2
            ),
            approach_timestamps = array_append(
                COALESCE(approach_timestamps, ARRAY[]::TIMESTAMP[]),
                $3
            )
        WHERE roblox_username = $1
    `, [robloxUsername, altitude, timestamp]);

    // Keep only last 30 readings
    await pool.query(`
        UPDATE logbook_active_flights
        SET approach_altitudes = approach_altitudes[greatest(1, array_length(approach_altitudes, 1) - 29):],
            approach_timestamps = approach_timestamps[greatest(1, array_length(approach_timestamps, 1) - 29):]
        WHERE roblox_username = $1
    `, [robloxUsername]);
}

// Calculate landing rate from approach data
export async function calculateLandingRate(robloxUsername) {
    // Get the flight_id and check for waypoint landing rate
    const flightResult = await pool.query(`
        SELECT laf.flight_id, lf.waypoint_landing_rate
        FROM logbook_active_flights laf
        JOIN logbook_flights lf ON laf.flight_id = lf.id
        WHERE laf.roblox_username = $1
    `, [robloxUsername]);

    if (!flightResult.rows[0]) {
        return null;
    }

    const { flight_id: flightId, waypoint_landing_rate } = flightResult.rows[0];

    // Priority 1: Use waypoint landing rate if available (from Project Flight API)
    if (waypoint_landing_rate !== null && waypoint_landing_rate !== undefined) {
        console.log(`[Landing Rate] Using waypoint data: ${waypoint_landing_rate} fpm`);
        return waypoint_landing_rate;
    }

    // Priority 2: Fallback to telemetry-based calculation
    const telemetryResult = await pool.query(`
        SELECT altitude_ft, vertical_speed_fpm, timestamp, flight_phase
        FROM logbook_telemetry
        WHERE flight_id = $1
        AND flight_phase IN ('approach', 'landing')
        AND altitude_ft < 100
        ORDER BY altitude_ft ASC
        LIMIT 1
    `, [flightId]);

    if (telemetryResult.rows.length === 0) {
        return null;
    }

    // Return the vertical speed at the lowest altitude point (touchdown)
    console.log(`[Landing Rate] Using telemetry data: ${telemetryResult.rows[0].vertical_speed_fpm} fpm`);
    return telemetryResult.rows[0].vertical_speed_fpm || null;
}

// Finalize flight with calculated stats
export async function finalizeFlight(flightId, stats) {
    await pool.query(`
        UPDATE logbook_flights
        SET flight_end = NOW(),
            duration_minutes = $2,
            total_distance_nm = $3,
            max_altitude_ft = $4,
            max_speed_kts = $5,
            average_speed_kts = $6,
            landing_rate_fpm = $7,
            smoothness_score = $8,
            landing_score = $9,
            flight_status = 'completed'
        WHERE id = $1
    `, [
        flightId,
        stats.durationMinutes,
        stats.totalDistance,
        stats.maxAltitude,
        stats.maxSpeed,
        stats.averageSpeed,
        stats.landingRate,
        stats.smoothnessScore,
        stats.landingScore
    ]);
}

// Remove active flight tracking
export async function removeActiveFlightTracking(robloxUsername) {
    await pool.query(`
        DELETE FROM logbook_active_flights
        WHERE roblox_username = $1
    `, [robloxUsername]);
}

// Get active flight by callsign
export async function getActiveFlightByCallsign(callsign) {
    const result = await pool.query(`
        SELECT laf.*, lf.id as flight_id, lf.user_id, lf.flight_status
        FROM logbook_active_flights laf
        JOIN logbook_flights lf ON laf.flight_id = lf.id
        WHERE laf.callsign = $1
    `, [callsign]);

    return result.rows[0] || null;
}

// Activate flight when controller sets status to "departure"
export async function activateFlightByCallsign(callsign) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if flight exists and is in pending state
        const result = await client.query(`
            UPDATE logbook_flights lf
            SET flight_status = 'active',
                flight_start = NOW(),
                activated_at = NOW(),
                controller_managed = true
            FROM logbook_active_flights laf
            WHERE laf.callsign = $1
                AND laf.flight_id = lf.id
                AND lf.flight_status = 'pending'
            RETURNING lf.id
        `, [callsign]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        await client.query('COMMIT');
        return result.rows[0].id;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error activating flight by callsign:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Complete flight when controller sets status to "gate"
export async function completeFlightByCallsign(callsign) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get flight data and stats in a single optimized query
        // Allow completing from both 'active' and 'pending' states
        // (pending = never departed but arriving, e.g., arrival controller picks up flight that departure never tracked)
        const flightResult = await client.query(`
            WITH flight_data AS (
                SELECT lf.*, laf.roblox_username, laf.approach_altitudes, laf.approach_timestamps
                FROM logbook_active_flights laf
                JOIN logbook_flights lf ON laf.flight_id = lf.id
                WHERE laf.callsign = $1 AND lf.flight_status IN ('active', 'pending')
            ),
            telemetry_stats AS (
                SELECT
                    flight_id,
                    MAX(altitude_ft) as max_altitude,
                    MAX(speed_kts) as max_speed,
                    ROUND(AVG(speed_kts) FILTER (WHERE speed_kts > 10))::INTEGER as avg_speed,
                    COUNT(*) as telemetry_count,
                    MIN(timestamp) as first_telemetry,
                    MAX(timestamp) as last_telemetry
                FROM logbook_telemetry
                WHERE flight_id = (SELECT id FROM flight_data)
                GROUP BY flight_id
            )
            SELECT
                fd.*,
                ts.max_altitude,
                ts.max_speed,
                ts.avg_speed,
                ts.telemetry_count,
                ts.first_telemetry,
                ts.last_telemetry
            FROM flight_data fd
            LEFT JOIN telemetry_stats ts ON ts.flight_id = fd.id
        `, [callsign]);

        if (flightResult.rows.length === 0) {
            await client.query('ROLLBACK');

            // Check if flight exists at all in logbook
            const checkFlight = await client.query(`
                SELECT lf.flight_status, lf.callsign, laf.callsign as active_callsign
                FROM logbook_flights lf
                LEFT JOIN logbook_active_flights laf ON laf.flight_id = lf.id
                WHERE lf.callsign = $1
            `, [callsign]);

            if (checkFlight.rows.length > 0) {
                const flight = checkFlight.rows[0];
                console.error(`[Logbook] Cannot complete ${callsign}: flight_status="${flight.flight_status}", in_active_table=${!!flight.active_callsign}`);
            } else {
                console.error(`[Logbook] Cannot complete ${callsign}: flight not found in logbook`);
            }

            return null;
        }

        const flightData = flightResult.rows[0];

        // Calculate distance from telemetry (need to iterate through points)
        const telemetryPoints = await client.query(`
            SELECT x, y, timestamp
            FROM logbook_telemetry
            WHERE flight_id = $1
            ORDER BY timestamp ASC
        `, [flightData.id]);

        let totalDistance = 0;
        for (let i = 1; i < telemetryPoints.rows.length; i++) {
            const prev = telemetryPoints.rows[i - 1];
            const curr = telemetryPoints.rows[i];
            if (prev.x && prev.y && curr.x && curr.y) {
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                const distance = Math.sqrt(dx * dx + dy * dy) / 1852;
                totalDistance += distance;
            }
        }

        // Calculate duration using SQL to avoid timezone issues
        const durationResult = await client.query(`
            SELECT EXTRACT(EPOCH FROM (NOW() - COALESCE(flight_start, created_at))) / 60 AS duration_minutes
            FROM logbook_flights
            WHERE id = $1
        `, [flightData.id]);
        const durationMinutes = Math.round(durationResult.rows[0].duration_minutes);

        // Calculate landing rate from approach data
        let landingRate = null;
        if (flightData.approach_altitudes && flightData.approach_altitudes.length >= 2) {
            const altitudes = flightData.approach_altitudes;
            const timestamps = flightData.approach_timestamps;
            const firstAlt = altitudes[0];
            const lastAlt = altitudes[altitudes.length - 1];
            const firstTime = new Date(timestamps[0]);
            const lastTime = new Date(timestamps[timestamps.length - 1]);
            const altChange = firstAlt - lastAlt;
            const timeChange = (lastTime - firstTime) / 1000;
            if (timeChange > 0) {
                const feetPerSecond = altChange / timeChange;
                landingRate = -Math.round(feetPerSecond * 60);
            }
        }

        // Calculate landing score (only if we have landing rate data)
        let landingScore = null;
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

        // Calculate smoothness score (only if we have enough telemetry)
        let smoothnessScore = null;

        // Fetch full telemetry data for smoothness calculation
        const telemetryData = await client.query(`
            SELECT speed_kts, vertical_speed_fpm, heading
            FROM logbook_telemetry
            WHERE flight_id = $1
            ORDER BY timestamp ASC
        `, [flightData.id]);

        if (telemetryData.rows.length > 2) {
            let score = 100;
            let speedPenalty = 0;
            let verticalSpeedPenalty = 0;
            let headingPenalty = 0;
            let validComparisons = 0;

            for (let i = 1; i < telemetryData.rows.length; i++) {
                const prev = telemetryData.rows[i - 1];
                const curr = telemetryData.rows[i];
                validComparisons++;

                // Speed smoothness
                if (prev.speed_kts != null && curr.speed_kts != null) {
                    const speedChange = Math.abs(curr.speed_kts - prev.speed_kts);
                    if (speedChange > 30) speedPenalty += 3;
                    else if (speedChange > 20) speedPenalty += 2;
                    else if (speedChange > 10) speedPenalty += 1;
                }

                // Vertical speed smoothness
                if (prev.vertical_speed_fpm != null && curr.vertical_speed_fpm != null) {
                    const vsChange = Math.abs(curr.vertical_speed_fpm - prev.vertical_speed_fpm);
                    if (vsChange > 500) verticalSpeedPenalty += 3;
                    else if (vsChange > 300) verticalSpeedPenalty += 2;
                    else if (vsChange > 150) verticalSpeedPenalty += 1;
                }

                // Heading smoothness
                if (prev.heading != null && curr.heading != null) {
                    let headingChange = Math.abs(curr.heading - prev.heading);
                    if (headingChange > 180) headingChange = 360 - headingChange;

                    if (headingChange > 30) headingPenalty += 2;
                    else if (headingChange > 20) headingPenalty += 1;
                }
            }

            // Calculate final score
            if (validComparisons > 0) {
                const totalPenalty = (speedPenalty * 0.4) + (verticalSpeedPenalty * 0.4) + (headingPenalty * 0.2);
                const avgPenalty = totalPenalty / validComparisons;
                score = 100 - Math.min(avgPenalty * 10, 100);
            }

            smoothnessScore = Math.max(0, Math.min(100, Math.round(score)));
        }

        // Update flight with final stats
        await client.query(`
            UPDATE logbook_flights
            SET flight_end = NOW(),
                duration_minutes = $2,
                total_distance_nm = $3,
                max_altitude_ft = $4,
                max_speed_kts = $5,
                average_speed_kts = $6,
                landing_rate_fpm = $7,
                smoothness_score = $8,
                landing_score = $9,
                flight_status = 'completed',
                controller_managed = true
            WHERE id = $1
        `, [
            flightData.id,
            durationMinutes,
            Math.round(totalDistance * 100) / 100,
            flightData.max_altitude || 0,
            flightData.max_speed || 0,
            flightData.avg_speed || 0,
            landingRate,
            smoothnessScore,
            landingScore
        ]);

        // Remove active flight tracking
        await client.query(`
            DELETE FROM logbook_active_flights
            WHERE callsign = $1
        `, [callsign]);

        await client.query('COMMIT');

        // Update user stats cache (outside transaction for performance)
        try {
            await updateUserStatsCache(flightData.user_id);
        } catch (error) {
            console.error('Error updating user stats cache:', error);
            // Don't fail the whole operation if stats cache update fails
        }

        return flightData.id;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error completing flight by callsign:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Calculate flight statistics from telemetry data
function calculateFlightStats(flightData, telemetryData, activeFlight) {
    if (!telemetryData || telemetryData.length === 0) {
        return {
            durationMinutes: 0,
            totalDistance: 0,
            maxAltitude: 0,
            maxSpeed: 0,
            averageSpeed: 0,
            landingRate: null,
            smoothnessScore: 50,
            landingScore: 50
        };
    }

    // Calculate duration
    const startTime = flightData.flight_start || flightData.created_at;
    const endTime = new Date();
    const durationMinutes = Math.round((endTime - new Date(startTime)) / 60000);

    // Calculate distance (sum of segments)
    let totalDistance = 0;
    for (let i = 1; i < telemetryData.length; i++) {
        const prev = telemetryData[i - 1];
        const curr = telemetryData[i];
        if (prev.x && prev.y && curr.x && curr.y) {
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const distance = Math.sqrt(dx * dx + dy * dy) / 1852; // Convert to NM
            totalDistance += distance;
        }
    }

    // Calculate max altitude and speed
    const maxAltitude = Math.max(...telemetryData.map(t => t.altitude_ft || 0));
    const maxSpeed = Math.max(...telemetryData.map(t => t.speed_kts || 0));

    // Calculate average speed (excluding stationary periods)
    const speeds = telemetryData.filter(t => t.speed_kts > 10).map(t => t.speed_kts);
    const averageSpeed = speeds.length > 0
        ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length)
        : 0;

    // Calculate landing rate from stored approach data
    let landingRate = null;
    if (activeFlight.approach_altitudes && activeFlight.approach_altitudes.length >= 2) {
        const altitudes = activeFlight.approach_altitudes;
        const timestamps = activeFlight.approach_timestamps;
        const firstAlt = altitudes[0];
        const lastAlt = altitudes[altitudes.length - 1];
        const firstTime = new Date(timestamps[0]);
        const lastTime = new Date(timestamps[timestamps.length - 1]);
        const altChange = firstAlt - lastAlt;
        const timeChange = (lastTime - firstTime) / 1000;
        if (timeChange > 0) {
            const feetPerSecond = altChange / timeChange;
            landingRate = -Math.round(feetPerSecond * 60);
        }
    }

    // Calculate smoothness score (0-100, based on multiple factors)
    let smoothnessScore = 100;

    if (telemetryData.length > 2) {
        let speedPenalty = 0;
        let verticalSpeedPenalty = 0;
        let headingPenalty = 0;
        let validComparisons = 0;

        for (let i = 1; i < telemetryData.length; i++) {
            const prev = telemetryData[i - 1];
            const curr = telemetryData[i];
            validComparisons++;

            // Speed smoothness (penalize sudden changes)
            if (prev.speed_kts != null && curr.speed_kts != null) {
                const speedChange = Math.abs(curr.speed_kts - prev.speed_kts);
                if (speedChange > 30) speedPenalty += 3;      // Very harsh acceleration/deceleration
                else if (speedChange > 20) speedPenalty += 2; // Harsh
                else if (speedChange > 10) speedPenalty += 1; // Moderate
            }

            // Vertical speed smoothness (penalize jerky climbs/descents)
            if (prev.vertical_speed_fpm != null && curr.vertical_speed_fpm != null) {
                const vsChange = Math.abs(curr.vertical_speed_fpm - prev.vertical_speed_fpm);
                if (vsChange > 500) verticalSpeedPenalty += 3;      // Very jerky
                else if (vsChange > 300) verticalSpeedPenalty += 2; // Jerky
                else if (vsChange > 150) verticalSpeedPenalty += 1; // Moderate
            }

            // Heading smoothness (penalize sudden turns)
            if (prev.heading != null && curr.heading != null) {
                // Handle 360-degree wraparound (e.g., 355 to 5 degrees is a 10-degree turn)
                let headingChange = Math.abs(curr.heading - prev.heading);
                if (headingChange > 180) headingChange = 360 - headingChange;

                if (headingChange > 30) headingPenalty += 2;      // Sharp turn
                else if (headingChange > 20) headingPenalty += 1; // Moderate turn
            }
        }

        // Calculate final score (weighted average of all factors)
        if (validComparisons > 0) {
            const totalPenalty = (speedPenalty * 0.4) + (verticalSpeedPenalty * 0.4) + (headingPenalty * 0.2);
            const avgPenalty = totalPenalty / validComparisons;
            smoothnessScore = 100 - Math.min(avgPenalty * 10, 100);
        }
    }

    smoothnessScore = Math.max(0, Math.min(100, Math.round(smoothnessScore)));

    // Calculate landing score (0-100, based on landing rate)
    let landingScore = 50;
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

    return {
        durationMinutes,
        totalDistance: Math.round(totalDistance * 100) / 100,
        maxAltitude,
        maxSpeed,
        averageSpeed,
        landingRate,
        smoothnessScore: Math.round(smoothnessScore),
        landingScore
    };
}

// Get user flights with pagination
export async function getUserFlights(userId, page = 1, limit = 20, status = 'completed') {
    const offset = (page - 1) * limit;

    // Use different ordering based on status (safe because we control the value)
    const useCreatedAt = (status === 'pending' || status === 'active');

    // Join with active flights to get current_phase for active/pending flights
    const result = await pool.query(`
        SELECT lf.*, laf.current_phase
        FROM logbook_flights lf
        LEFT JOIN logbook_active_flights laf ON laf.flight_id = lf.id
        WHERE lf.user_id = $1 AND lf.flight_status = $2
        ORDER BY ${useCreatedAt ? 'lf.created_at' : 'COALESCE(lf.flight_start, lf.created_at)'} DESC
        LIMIT $3 OFFSET $4
    `, [userId, status, limit, offset]);

    const countResult = await pool.query(`
        SELECT COUNT(*) FROM logbook_flights
        WHERE user_id = $1 AND flight_status = $2
    `, [userId, status]);

    return {
        flights: result.rows,
        pagination: {
            page,
            limit,
            total: parseInt(countResult.rows[0].count),
            pages: Math.ceil(countResult.rows[0].count / limit),
            hasMore: page < Math.ceil(countResult.rows[0].count / limit)
        }
    };
}

// Get single flight with telemetry
export async function getFlightById(flightId) {
    const result = await pool.query(`
        SELECT * FROM logbook_flights
        WHERE id = $1
    `, [flightId]);

    return result.rows[0] || null;
}

// Get active flight data with real-time telemetry
export async function getActiveFlightData(flightId) {
    // Get flight details
    const flight = await getFlightById(flightId);
    if (!flight) return null;

    // If flight is not active, return regular flight data
    if (flight.flight_status !== 'active' && flight.flight_status !== 'pending') {
        return flight;
    }

    // Get active tracking data
    const activeResult = await pool.query(`
        SELECT * FROM logbook_active_flights
        WHERE flight_id = $1
    `, [flightId]);

    const activeData = activeResult.rows[0];

    // Calculate in-progress stats from telemetry
    const statsResult = await pool.query(`
        SELECT
            COUNT(*) as telemetry_count,
            MAX(altitude_ft) as max_altitude_ft,
            MAX(speed_kts) as max_speed_kts,
            AVG(CASE WHEN altitude_ft > 100 THEN speed_kts ELSE NULL END) as avg_speed_kts
        FROM logbook_telemetry
        WHERE flight_id = $1
    `, [flightId]);

    const stats = statsResult.rows[0];

    // Calculate duration so far
    const durationMs = new Date() - new Date(flight.created_at);
    const durationMinutes = Math.round(durationMs / 60000);

    // Merge data
    return {
        ...flight,
        // Real-time data from active tracking
        current_altitude: activeData?.last_altitude || null,
        current_speed: activeData?.last_speed || null,
        current_heading: activeData?.last_heading || null,
        current_phase: activeData?.current_phase || null,
        last_update: activeData?.last_update || null,
        landing_detected: activeData?.landing_detected || false,

        // In-progress stats
        duration_minutes: durationMinutes,
        max_altitude_ft: stats.max_altitude_ft || null,
        max_speed_kts: stats.max_speed_kts || null,
        average_speed_kts: stats.avg_speed_kts ? Math.round(stats.avg_speed_kts) : null,
        telemetry_count: parseInt(stats.telemetry_count) || 0,

        // Flag to indicate this is live data
        is_active: true
    };
}

// Get flight telemetry
export async function getFlightTelemetry(flightId) {
    const result = await pool.query(`
        SELECT * FROM logbook_telemetry
        WHERE flight_id = $1
        ORDER BY timestamp ASC
    `, [flightId]);

    return result.rows;
}

// Get or create user stats cache
export async function getUserStats(userId) {
    let result = await pool.query(`
        SELECT * FROM logbook_stats_cache
        WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
        // Create initial stats
        await pool.query(`
            INSERT INTO logbook_stats_cache (user_id)
            VALUES ($1)
        `, [userId]);

        result = await pool.query(`
            SELECT * FROM logbook_stats_cache
            WHERE user_id = $1
        `, [userId]);
    }

    return result.rows[0];
}

// Update user stats cache
export async function updateUserStatsCache(userId) {
    // Calculate totals (only include flights with valid duration)
    const totals = await pool.query(`
        SELECT
            COUNT(*) as total_flights,
            COALESCE(SUM(CASE WHEN duration_minutes > 0 THEN duration_minutes ELSE 0 END), 0) as total_minutes,
            COALESCE(SUM(CASE WHEN duration_minutes > 0 THEN duration_minutes ELSE 0 END) / 60.0, 0) as total_hours,
            COALESCE(SUM(total_distance_nm), 0) as total_distance
        FROM logbook_flights
        WHERE user_id = $1 AND flight_status = 'completed'
    `, [userId]);

    // Favorite aircraft
    const favAircraft = await pool.query(`
        SELECT aircraft_model, COUNT(*) as count
        FROM logbook_flights
        WHERE user_id = $1 AND flight_status = 'completed' AND aircraft_model IS NOT NULL
        GROUP BY aircraft_model
        ORDER BY count DESC
        LIMIT 1
    `, [userId]);

    // Favorite departure airport
    const favDeparture = await pool.query(`
        SELECT departure_icao, COUNT(*) as count
        FROM logbook_flights
        WHERE user_id = $1 AND flight_status = 'completed' AND departure_icao IS NOT NULL
        GROUP BY departure_icao
        ORDER BY count DESC
        LIMIT 1
    `, [userId]);

    // Smoothest landing (best landing rate)
    const smoothestLanding = await pool.query(`
        SELECT id, landing_rate_fpm
        FROM logbook_flights
        WHERE user_id = $1 AND flight_status = 'completed' AND landing_rate_fpm IS NOT NULL
        ORDER BY ABS(landing_rate_fpm) ASC
        LIMIT 1
    `, [userId]);

    // Average landing score
    const avgLandingScore = await pool.query(`
        SELECT AVG(landing_score) as avg_score
        FROM logbook_flights
        WHERE user_id = $1 AND flight_status = 'completed' AND landing_score IS NOT NULL
    `, [userId]);

    // Highest altitude
    const highestAlt = await pool.query(`
        SELECT MAX(max_altitude_ft) as highest_altitude
        FROM logbook_flights
        WHERE user_id = $1 AND flight_status = 'completed'
    `, [userId]);

    // Longest flight
    const longestFlight = await pool.query(`
        SELECT id, total_distance_nm
        FROM logbook_flights
        WHERE user_id = $1 AND flight_status = 'completed'
        ORDER BY total_distance_nm DESC
        LIMIT 1
    `, [userId]);

    // Safely extract values with proper defaults
    const totalFlights = parseInt(totals.rows[0].total_flights) || 0;
    const totalMinutes = parseInt(totals.rows[0].total_minutes) || 0;
    const totalHours = parseFloat(totals.rows[0].total_hours) || 0;
    const totalDistance = parseFloat(totals.rows[0].total_distance) || 0;

    await pool.query(`
        UPDATE logbook_stats_cache
        SET total_flights = $2,
            total_hours = $3,
            total_flight_time_minutes = $4,
            total_distance_nm = $5,
            favorite_aircraft = $6,
            favorite_aircraft_count = $7,
            favorite_departure = $8,
            favorite_departure_count = $9,
            smoothest_landing_rate = $10,
            smoothest_landing_flight_id = $11,
            best_landing_rate = $12,
            average_landing_score = $13,
            highest_altitude = $14,
            longest_flight_distance = $15,
            longest_flight_id = $16,
            last_updated = NOW()
        WHERE user_id = $1
    `, [
        userId,
        totalFlights,
        totalHours,
        totalMinutes,
        totalDistance,
        favAircraft.rows[0]?.aircraft_model || null,
        favAircraft.rows[0]?.count || 0,
        favDeparture.rows[0]?.departure_icao || null,
        favDeparture.rows[0]?.count || 0,
        smoothestLanding.rows[0]?.landing_rate_fpm || null,
        smoothestLanding.rows[0]?.id || null,
        smoothestLanding.rows[0]?.landing_rate_fpm || null, // best_landing_rate (same as smoothest)
        avgLandingScore.rows[0]?.avg_score ? parseFloat(avgLandingScore.rows[0].avg_score) : null,
        highestAlt.rows[0]?.highest_altitude || null,
        longestFlight.rows[0]?.total_distance_nm ? parseFloat(longestFlight.rows[0].total_distance_nm) : null,
        longestFlight.rows[0]?.id || null
    ]);
}

// Delete flight by ID (user can only delete pending flights, admins can delete any)
export async function deleteFlightById(flightId, userId, isAdmin = false) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // First check if flight exists and belongs to user
        const flightCheck = await client.query(`
            SELECT id, user_id, flight_status
            FROM logbook_flights
            WHERE id = $1
        `, [flightId]);

        if (flightCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Flight not found' };
        }

        const flight = flightCheck.rows[0];

        // Check ownership
        if (flight.user_id !== userId && !isAdmin) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Unauthorized' };
        }

        // Regular users can only delete pending flights
        if (!isAdmin && flight.flight_status !== 'pending') {
            await client.query('ROLLBACK');
            return { success: false, error: 'Can only delete pending flights' };
        }

        // Delete from active flights table if present
        await client.query(`
            DELETE FROM logbook_active_flights
            WHERE flight_id = $1
        `, [flightId]);

        // Delete telemetry (will cascade anyway, but explicit is good)
        await client.query(`
            DELETE FROM logbook_telemetry
            WHERE flight_id = $1
        `, [flightId]);

        // Delete the flight
        await client.query(`
            DELETE FROM logbook_flights
            WHERE id = $1
        `, [flightId]);

        await client.query('COMMIT');

        // Update stats cache if it was a completed flight
        if (flight.flight_status === 'completed') {
            try {
                await updateUserStatsCache(flight.user_id);
            } catch (error) {
                console.error('Error updating stats cache after deletion:', error);
            }
        }

        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting flight:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ==== WAYPOINT FUNCTIONS (Project Flight API landing data) ====

/**
 * Store a waypoint from Project Flight username WebSocket
 * @param {string} robloxUsername - Roblox username
 * @param {Object} waypointData - Waypoint data {airport, runway, position_x, position_y, landing_speed, timestamp}
 */
export async function storeWaypoint(robloxUsername, waypointData) {
    // Get current waypoints
    const result = await pool.query(`
        SELECT collected_waypoints FROM logbook_active_flights
        WHERE roblox_username = $1
    `, [robloxUsername]);

    if (result.rows.length === 0) {
        console.warn(`[Waypoint] No active flight found for ${robloxUsername}`);
        return;
    }

    const existingWaypoints = result.rows[0].collected_waypoints || [];

    // Add new waypoint to array
    const updatedWaypoints = [...existingWaypoints, waypointData];

    // Update database
    await pool.query(`
        UPDATE logbook_active_flights
        SET collected_waypoints = $2::jsonb
        WHERE roblox_username = $1
    `, [robloxUsername, JSON.stringify(updatedWaypoints)]);

    console.log(`[Waypoint] Stored waypoint for ${robloxUsername}: ${waypointData.airport} ${waypointData.runway} @ ${waypointData.landing_speed} fpm`);
}

/**
 * Finalize landing rate from collected waypoints
 * Selects the oldest waypoint from the recent cluster (ignores old waypoints)
 * @param {string} robloxUsername - Roblox username
 * @returns {Promise<Object|null>} Selected waypoint data or null
 */
export async function finalizeLandingFromWaypoints(robloxUsername) {
    const result = await pool.query(`
        SELECT collected_waypoints, flight_id
        FROM logbook_active_flights
        WHERE roblox_username = $1
    `, [robloxUsername]);

    if (result.rows.length === 0 || !result.rows[0].collected_waypoints) {
        console.log(`[Waypoint] No waypoints collected for ${robloxUsername}`);
        return null;
    }

    const waypoints = result.rows[0].collected_waypoints;
    const flightId = result.rows[0].flight_id;

    if (waypoints.length === 0) {
        return null;
    }

    // Find the most recent waypoint timestamp
    const timestamps = waypoints.map(w => w.timestamp);
    const maxTimestamp = Math.max(...timestamps);

    // Filter waypoints to recent cluster (within 90 seconds of most recent)
    const recentCluster = waypoints.filter(w => {
        const timeDiff = maxTimestamp - w.timestamp;
        return timeDiff <= 90; // 90 second window
    });

    if (recentCluster.length === 0) {
        console.log(`[Waypoint] No recent waypoints found for ${robloxUsername}`);
        return null;
    }

    // Pick the HARDEST landing from the recent cluster (matches what the game displays)
    const selectedWaypoint = recentCluster.reduce((hardest, current) => {
        const hardestRate = Math.abs(hardest.landing_speed);
        const currentRate = Math.abs(current.landing_speed);
        return currentRate > hardestRate ? current : hardest;
    });

    console.log(`[Waypoint] Selected waypoint for ${robloxUsername}:`, selectedWaypoint);

    // Update flight record with waypoint landing data
    await pool.query(`
        UPDATE logbook_flights
        SET waypoint_landing_rate = $2,
            landed_runway = $3,
            landed_airport = $4
        WHERE id = $1
    `, [flightId, Math.round(selectedWaypoint.landing_speed), selectedWaypoint.runway, selectedWaypoint.airport]);

    return selectedWaypoint;
}

// Initialize tables on startup
initializeLogbookTables();
