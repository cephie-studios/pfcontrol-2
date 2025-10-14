import pool from './connections/connection.js';
import { isAdmin } from '../middleware/isAdmin.js';

async function initializeRolesTable() {
    try {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'roles'
            )
        `);
        const exists = result.rows[0].exists;

        if (!exists) {
            await pool.query(`
                CREATE TABLE roles (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(50) NOT NULL UNIQUE,
                    description TEXT,
                    permissions JSONB NOT NULL DEFAULT '{}',
                    color VARCHAR(7) DEFAULT '#6366F1',
                    icon VARCHAR(50) DEFAULT 'Star',
                    priority INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await pool.query(`
                INSERT INTO roles (name, description, permissions, color, icon, priority)
                VALUES (
                    'Support',
                    'Support team with limited admin access',
                    '{"admin": true, "users": true, "sessions": true, "audit": false, "bans": false, "testers": false, "notifications": false, "roles": false}',
                    '#3B82F6',
                    'Wrench',
                    1
                )
            `);
        } else {
            // Add new columns if they don't exist (migration)
            const colorColumn = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'roles' AND column_name = 'color'
            `);
            if (colorColumn.rows.length === 0) {
                await pool.query(`ALTER TABLE roles ADD COLUMN color VARCHAR(7) DEFAULT '#6366F1'`);
            }

            const iconColumn = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'roles' AND column_name = 'icon'
            `);
            if (iconColumn.rows.length === 0) {
                await pool.query(`ALTER TABLE roles ADD COLUMN icon VARCHAR(50) DEFAULT 'Star'`);
            }

            const priorityColumn = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'roles' AND column_name = 'priority'
            `);
            if (priorityColumn.rows.length === 0) {
                await pool.query(`ALTER TABLE roles ADD COLUMN priority INTEGER DEFAULT 0`);
            }
        }

        // Create user_roles junction table for many-to-many relationship
        const userRolesTable = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'user_roles'
            )
        `);

        if (!userRolesTable.rows[0].exists) {
            await pool.query(`
                CREATE TABLE user_roles (
                    user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE,
                    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
                    assigned_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (user_id, role_id)
                )
            `);

            // Migrate existing single role_id to junction table
            await pool.query(`
                INSERT INTO user_roles (user_id, role_id)
                SELECT id, role_id FROM users WHERE role_id IS NOT NULL
            `);
        }

        // Keep role_id for backward compatibility (will be deprecated)
        const userTableResult = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'role_id'
        `);

        if (userTableResult.rows.length === 0) {
            await pool.query(`
                ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id)
            `);
        }
    } catch (error) {
        console.error('Error initializing roles table:', error);
    }
}

export async function getAllRoles() {
    try {
        const result = await pool.query(`
            SELECT r.*, COUNT(DISTINCT ur.user_id) as user_count
            FROM roles r
            LEFT JOIN user_roles ur ON ur.role_id = r.id
            GROUP BY r.id
            ORDER BY r.priority DESC, r.created_at DESC
        `);
        return result.rows;
    } catch (error) {
        console.error('Error fetching roles:', error);
        throw error;
    }
}

export async function getRoleById(id) {
    try {
        const result = await pool.query(`
            SELECT * FROM roles WHERE id = $1
        `, [id]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error fetching role by ID:', error);
        throw error;
    }
}

export async function createRole({ name, description, permissions, color, icon, priority }) {
    try {
        const result = await pool.query(`
            INSERT INTO roles (name, description, permissions, color, icon, priority)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            name,
            description,
            JSON.stringify(permissions),
            color || '#6366F1',
            icon || 'Star',
            priority || 0
        ]);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating role:', error);
        throw error;
    }
}

export async function updateRole(id, { name, description, permissions, color, icon, priority }) {
    try {
        let setClause = [];
        let values = [];
        let paramIndex = 1;

        if (name !== undefined) {
            setClause.push(`name = $${paramIndex++}`);
            values.push(name);
        }
        if (description !== undefined) {
            setClause.push(`description = $${paramIndex++}`);
            values.push(description);
        }
        if (permissions !== undefined) {
            setClause.push(`permissions = $${paramIndex++}`);
            values.push(JSON.stringify(permissions));
        }
        if (color !== undefined) {
            setClause.push(`color = $${paramIndex++}`);
            values.push(color);
        }
        if (icon !== undefined) {
            setClause.push(`icon = $${paramIndex++}`);
            values.push(icon);
        }
        if (priority !== undefined) {
            setClause.push(`priority = $${paramIndex++}`);
            values.push(priority);
        }

        setClause.push(`updated_at = NOW()`);
        const query = `
            UPDATE roles
            SET ${setClause.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;
        values.push(id);

        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error updating role:', error);
        throw error;
    }
}

export async function deleteRole(id) {
    try {
        // Delete from junction table
        await pool.query(`DELETE FROM user_roles WHERE role_id = $1`, [id]);

        // Keep backward compatibility
        await pool.query(`UPDATE users SET role_id = NULL WHERE role_id = $1`, [id]);

        const result = await pool.query(`
            DELETE FROM roles WHERE id = $1 RETURNING *
        `, [id]);
        return result.rows[0];
    } catch (error) {
        console.error('Error deleting role:', error);
        throw error;
    }
}

export async function assignRoleToUser(userId, roleId) {
    try {
        // Insert into junction table (ON CONFLICT DO NOTHING to avoid duplicates)
        await pool.query(`
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, role_id) DO NOTHING
        `, [userId, roleId]);

        // Keep backward compatibility - set as primary role if user has no role_id
        const user = await pool.query(`SELECT role_id FROM users WHERE id = $1`, [userId]);
        if (!user.rows[0]?.role_id) {
            await pool.query(`
                UPDATE users SET role_id = $2, updated_at = NOW()
                WHERE id = $1
            `, [userId, roleId]);
        }

        return { userId, roleId };
    } catch (error) {
        console.error('Error assigning role to user:', error);
        throw error;
    }
}

export async function removeRoleFromUser(userId, roleId) {
    try {
        // Remove from junction table
        await pool.query(`
            DELETE FROM user_roles
            WHERE user_id = $1 AND role_id = $2
        `, [userId, roleId]);

        // If removing the primary role, clear it
        const user = await pool.query(`SELECT role_id FROM users WHERE id = $1`, [userId]);
        if (user.rows[0]?.role_id === roleId) {
            await pool.query(`
                UPDATE users SET role_id = NULL, updated_at = NOW()
                WHERE id = $1
            `, [userId]);
        }

        return { userId, roleId };
    } catch (error) {
        console.error('Error removing role from user:', error);
        throw error;
    }
}

export async function getUserRoles(userId) {
    try {
        const result = await pool.query(`
            SELECT r.*
            FROM roles r
            JOIN user_roles ur ON ur.role_id = r.id
            WHERE ur.user_id = $1
            ORDER BY r.priority DESC, r.created_at DESC
        `, [userId]);
        return result.rows;
    } catch (error) {
        console.error('Error fetching user roles:', error);
        throw error;
    }
}

export async function updateRolePriorities(rolePriorities) {
    try {
        // rolePriorities is an array of { id, priority }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const { id, priority } of rolePriorities) {
                await client.query(`
                    UPDATE roles
                    SET priority = $1, updated_at = NOW()
                    WHERE id = $2
                `, [priority, id]);
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
        return true;
    } catch (error) {
        console.error('Error updating role priorities:', error);
        throw error;
    }
}

export async function getUsersWithRoles() {
    try {
        // Get all users with at least one role or are admin
        const usersResult = await pool.query(`
            SELECT DISTINCT u.id, u.username, u.avatar, u.created_at, u.role_id
            FROM users u
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            WHERE ur.role_id IS NOT NULL OR u.role_id IS NOT NULL
            ORDER BY u.username
        `);

        // Get all roles for each user
        const usersWithRoles = await Promise.all(
            usersResult.rows.map(async (user) => {
                const rolesResult = await pool.query(`
                    SELECT r.id, r.name, r.color, r.icon, r.priority, r.permissions
                    FROM roles r
                    JOIN user_roles ur ON ur.role_id = r.id
                    WHERE ur.user_id = $1
                    ORDER BY r.priority DESC, r.created_at DESC
                `, [user.id]);

                return {
                    ...user,
                    is_admin: isAdmin(user.id),
                    roles: rolesResult.rows,
                    // Legacy support - keep first role as primary
                    role_name: rolesResult.rows[0]?.name || null,
                    role_permissions: rolesResult.rows[0]?.permissions || null
                };
            })
        );

        // Also include pure admins
        const allUsersResult = await pool.query(`
            SELECT u.id, u.username, u.avatar, u.created_at, u.role_id
            FROM users u
            ORDER BY u.username
        `);

        const allRelevantUsers = await Promise.all(
            allUsersResult.rows
                .filter(user => isAdmin(user.id) || usersWithRoles.find(u => u.id === user.id))
                .map(async (user) => {
                    const existing = usersWithRoles.find(u => u.id === user.id);
                    if (existing) return existing;

                    return {
                        ...user,
                        is_admin: isAdmin(user.id),
                        roles: [],
                        role_name: null,
                        role_permissions: null
                    };
                })
        );

        const uniqueUsers = allRelevantUsers.reduce((acc, user) => {
            if (!acc.find(u => u.id === user.id)) {
                acc.push(user);
            }
            return acc;
        }, []);

        return uniqueUsers.sort((a, b) => a.username.localeCompare(b.username));
    } catch (error) {
        console.error('Error fetching users with roles:', error);
        throw error;
    }
}

initializeRolesTable();

export { initializeRolesTable };