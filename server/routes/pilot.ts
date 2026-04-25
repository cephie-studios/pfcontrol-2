import express from 'express';
import { getUserByUsername } from '../db/users.js';
import { mainDb } from '../db/connection.js';
import { isAdmin } from '../middleware/admin.js';
import { getControllerRatingStats } from '../db/ratings.js';
import { trafficScraper } from '../utils/trafficScraper.js';
import requireAuth from '../middleware/auth.js';
import { getAirlineData } from '../utils/getData.js';

const router = express.Router();

// GET: /api/pilot/:username - Get public pilot profile (user info only)
router.get('/:username', async (req, res) => {
  try {
    const username = req.params.username;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const userResult = await getUserByUsername(username);

    if (!userResult) {
      return res.status(404).json({ error: 'Pilot not found' });
    }

    const rolesResult = await mainDb
      .selectFrom('roles as r')
      .innerJoin('user_roles as ur', 'ur.role_id', 'r.id')
      .select([
        'r.id',
        'r.name',
        'r.description',
        'r.color',
        'r.icon',
        'r.priority',
      ])
      .where('ur.user_id', '=', userResult.id)
      .orderBy('r.priority', 'desc')
      .orderBy('r.created_at', 'desc')
      .execute();

    const privacySettings = {
      displayControllerStatsOnProfile:
        userResult.settings?.displayControllerStatsOnProfile ?? true,
      displayPilotStatsOnProfile:
        userResult.settings?.displayPilotStatsOnProfile ?? true,
      displayControllerRatingOnProfile:
        userResult.settings?.displayControllerRatingOnProfile ?? true,
      displayLinkedAccountsOnProfile:
        userResult.settings?.displayLinkedAccountsOnProfile ?? true,
      displayBackgroundOnProfile:
        userResult.settings?.displayBackgroundOnProfile ?? true,
    };

    const shouldIncludeStats = privacySettings.displayPilotStatsOnProfile;
    const shouldIncludeLinkedAccounts =
      privacySettings.displayLinkedAccountsOnProfile;
    const shouldIncludeBackground = privacySettings.displayBackgroundOnProfile;
    const shouldIncludeRating = privacySettings.displayControllerRatingOnProfile;

    let ratingStats = null;
    if (shouldIncludeRating) {
        ratingStats = await getControllerRatingStats(userResult.id);
    }

    const profile = {
      user: {
        id: userResult.id,
        username: userResult.username,
        discriminator: userResult.discriminator,
        avatar: userResult.avatar,
        roblox_username: shouldIncludeLinkedAccounts
          ? userResult.roblox_username
          : null,
        roblox_user_id: shouldIncludeLinkedAccounts
          ? userResult.roblox_user_id
          : null,
        vatsim_cid: shouldIncludeLinkedAccounts ? userResult.vatsim_cid : null,
        vatsim_rating_short: shouldIncludeLinkedAccounts
          ? userResult.vatsim_rating_short
          : null,
        vatsim_rating_long: shouldIncludeLinkedAccounts
          ? userResult.vatsim_rating_long
          : null,
        member_since: userResult.created_at,
        is_admin: isAdmin(userResult.id),
        roles: rolesResult,
        role_name: rolesResult[0]?.name || null,
        role_description: rolesResult[0]?.description || null,
        bio: userResult.settings?.bio ?? '',
        statistics: shouldIncludeStats ? userResult.statistics || {} : {},
        rating: ratingStats,
        background_image: shouldIncludeBackground
          ? userResult.settings?.backgroundImage
          : null,
      },
      privacySettings,
    };

    res.json(profile);
  } catch (error) {
    console.error('Error fetching pilot profile:', error);
    res.status(500).json({ error: 'Failed to fetch pilot profile' });
  }
});

// GET: /api/pilot/callsign - Get current callsign for logged in user
router.get('/callsign/data', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await mainDb
      .selectFrom('users')
      .select(['roblox_username'])
      .where('id', '=', req.user.userId)
      .executeTakeFirst();

    if (!user || !user.roblox_username) {
      return res.status(404).json({ error: 'Roblox account not connected' });
    }

    const trafficData = trafficScraper.getCallsignForUser(user.roblox_username);

    if (!trafficData) {
      return res.status(404).json({ error: 'No active flight found for this user' });
    }

    let airlineName = null;
    let convertedCallsign = trafficData.callsign;
    
    if (trafficData.callsign) {
      const airlineData = getAirlineData();
      interface Airline {
        icao: string;
        callsign: string;
      }

      const sortedAirlines = [...airlineData].sort((a, b) => b.callsign.length - a.callsign.length);
      
      const upperCallsign = trafficData.callsign.toUpperCase();
      const match = sortedAirlines.find((a: Airline) => upperCallsign.startsWith(a.callsign.toUpperCase()));

      if (match) {
        airlineName = match.callsign;
        const remaining = upperCallsign.substring(match.callsign.length).trim();
        convertedCallsign = `${match.icao}${remaining}`;
      } else {
        const icaoMatch = trafficData.callsign.match(/^([A-Z]{3})/);
        if (icaoMatch) {
          const icao = icaoMatch[1];
          const airline = airlineData.find((a: Airline) => a.icao === icao);
          if (airline) {
            airlineName = airline.callsign;
          }
        }
      }
    }

    res.json({
      ...trafficData,
      callsign: convertedCallsign,
      originalCallsign: trafficData.callsign,
      airlineName,
    });
  } catch (error) {
    console.error('Error fetching pilot callsign:', error);
    res.status(500).json({ error: 'Failed to fetch pilot callsign' });
  }
});

export default router;
