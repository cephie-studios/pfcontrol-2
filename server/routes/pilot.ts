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
            displayBackgroundOnProfile: userResult.settings?.displayBackgroundOnProfile ?? true,
        };

        const shouldIncludeStats = privacySettings.displayPilotStatsOnProfile;
        const shouldIncludeLinkedAccounts = privacySettings.displayLinkedAccountsOnProfile;

        const profile = {
            user: {
                id: userResult.id,
                username: userResult.username,
                discriminator: userResult.discriminator,
                avatar: userResult.avatar,
                roblox_username: shouldIncludeLinkedAccounts ? userResult.roblox_username : null,
                roblox_user_id: shouldIncludeLinkedAccounts ? userResult.roblox_user_id : null,
                vatsim_cid: shouldIncludeLinkedAccounts ? userResult.vatsim_cid : null,
                vatsim_rating_short: shouldIncludeLinkedAccounts ? userResult.vatsim_rating_short : null,
                vatsim_rating_long: shouldIncludeLinkedAccounts ? userResult.vatsim_rating_long : null,
                member_since: userResult.created_at,
                roles: rolesResult,
                role_name: rolesResult[0]?.name || null,
                role_description: rolesResult[0]?.description || null,
                bio: userResult.settings?.bio ?? '',
                statistics: shouldIncludeStats ? (userResult.statistics || {}) : {},
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