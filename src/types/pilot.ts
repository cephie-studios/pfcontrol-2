export interface Role {
    id: number;
    name: string;
    description: string | null;
    color: string;
    icon: string;
    priority: number;
}

export interface PilotProfile {
    user: {
        id: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        roblox_username: string | null;
        roblox_user_id?: string | null;
        vatsim_cid: string | null;
        vatsim_rating_short: string | null;
        vatsim_rating_long: string | null;
        member_since: string;
        is_admin: boolean;
        roles: Role[];
        role_name: string | null;
        role_description: string | null;
        bio: string;
        statistics: Record<string, unknown>;
    };
    privacySettings: {
        displayControllerStatsOnProfile: boolean;
        displayPilotStatsOnProfile: boolean;
        displayLinkedAccountsOnProfile: boolean;
        displayBackgroundOnProfile: boolean;
    };
}