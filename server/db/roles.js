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
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await pool.query(`
                INSERT INTO roles (name, description, permissions)
                VALUES (
                    'Support',
                    'Support team with limited admin access',
                    '{"admin": true, "users": true, "sessions": true, "audit": false, "bans": false, "testers": false, "notifications": false, "roles": false}'
                )
            `);
        }

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
            SELECT r.*, COUNT(u.id) as user_count
            FROM roles r
            LEFT JOIN users u ON u.role_id = r.id
            GROUP BY r.id
            ORDER BY r.created_at DESC
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

export async function createRole({ name, description, permissions }) {
    try {
        const result = await pool.query(`
            INSERT INTO roles (name, description, permissions)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [name, description, JSON.stringify(permissions)]);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating role:', error);
        throw error;
    }
}

export async function updateRole(id, { name, description, permissions }) {
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
        const result = await pool.query(`
            UPDATE users SET role_id = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING id, username, role_id
        `, [userId, roleId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error assigning role to user:', error);
        throw error;
    }
}

export async function removeRoleFromUser(userId) {
    try {
        const result = await pool.query(`
            UPDATE users SET role_id = NULL, updated_at = NOW()
            WHERE id = $1
            RETURNING id, username, role_id
        `, [userId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error removing role from user:', error);
        throw error;
    }
}

export async function getUsersWithRoles() {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, u.avatar, u.created_at,
                   r.id as role_id, r.name as role_name, r.permissions as role_permissions
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.role_id IS NOT NULL
            ORDER BY u.username
        `);

        const usersWithAdminStatus = result.rows.map(user => ({
            ...user,
            is_admin: isAdmin(user.id)
        }));

        const adminResult = await pool.query(`
            SELECT u.id, u.username, u.avatar, u.created_at,
                   r.id as role_id, r.name as role_name, r.permissions as role_permissions
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            ORDER BY u.username
        `);

        const allRelevantUsers = adminResult.rows
            .filter(user => isAdmin(user.id) || user.role_id !== null)
            .map(user => ({
                ...user,
                is_admin: isAdmin(user.id)
            }));

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