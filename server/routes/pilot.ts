import express from 'express';
import { getUserByUsername } from '../db/users.js';
import { mainDb } from '../db/connection.js';

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
            .select(['r.id', 'r.name', 'r.description', 'r.color', 'r.icon', 'r.priority'])
            .where('ur.user_id', '=', userResult.id)
            .orderBy('r.priority', 'desc')
            .orderBy('r.created_at', 'desc')
            .execute();

        const privacySettings = {
            displayControllerStatsOnProfile: userResult.settings?.displayControllerStatsOnProfile ?? true,
            displayPilotStatsOnProfile: userResult.settings?.displayPilotStatsOnProfile ?? true,
            displayLinkedAccountsOnProfile: userResult.settings?.displayLinkedAccountsOnProfile ?? true,
        };

        const profile = {
            user: {
                id: userResult.id,
                username: userResult.username,
                discriminator: userResult.discriminator,
                avatar: userResult.avatar,
                roblox_username: userResult.roblox_username,
                roblox_user_id: userResult.roblox_user_id,
                vatsim_cid: userResult.vatsim_cid,
                vatsim_rating_short: userResult.vatsim_rating_short,
                vatsim_rating_long: userResult.vatsim_rating_long,
                member_since: userResult.created_at,
                roles: rolesResult,
                role_name: rolesResult[0]?.name || null,
                role_description: rolesResult[0]?.description || null,
            },
            privacySettings,
        };

        res.json(profile);
    } catch (error) {
        console.error('Error fetching pilot profile:', error);
        res.status(500).json({ error: 'Failed to fetch pilot profile' });
    }
});

export default router;