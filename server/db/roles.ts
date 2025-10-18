import { mainDb } from "./connection.js";
import { sql } from "kysely";
import { isAdmin } from "../middleware/admin.js";
import { invalidateAllUsersCache } from './admin.js';

export async function getAllRoles() {
  try {
    const result = await mainDb
      .selectFrom('roles as r')
      .leftJoin('user_roles as ur', 'ur.role_id', 'r.id')
      .select([
        'r.id',
        'r.name',
        'r.description',
        'r.permissions',
        'r.color',
        'r.icon',
        'r.priority',
        'r.created_at',
        'r.updated_at',
        sql<number>`COUNT(DISTINCT ur.user_id)`.as('user_count')
      ])
      .groupBy('r.id')
      .orderBy('r.priority', 'desc')
      .orderBy('r.created_at', 'desc')
      .execute();

    return result;
  } catch (error) {
    console.error('Error fetching roles:', error);
    throw error;
  }
}

export async function getRoleById(id: number) {
  try {
    const result = await mainDb
      .selectFrom('roles')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return result || null;
  } catch (error) {
    console.error('Error fetching role by ID:', error);
    throw error;
  }
}

export async function createRole({ name, description, permissions, color, icon, priority }: {
  name: string;
  description?: string;
  permissions: Record<string, unknown>;
  color?: string;
  icon?: string;
  priority?: number;
}) {
  try {
    const result = await mainDb
      .insertInto('roles')
      .values({
        id: sql`DEFAULT`,
        name,
        description,
        permissions: sql`CAST(${JSON.stringify(permissions)} AS jsonb)`,
        color: color || '#6366F1',
        icon: icon || 'Star',
        priority: priority ?? 0,
      })
      .returningAll()
      .executeTakeFirst();

    return result || null;
  } catch (error) {
    console.error('Error creating role:', error);
    throw error;
  }
}
export async function updateRole(
  id: number,
  { name, description, permissions, color, icon, priority }: {
    name?: string;
    description?: string;
    permissions?: Record<string, unknown>;
    color?: string;
    icon?: string;
    priority?: number;
  }
) {
  try {
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissions !== undefined) updateData.permissions = sql`CAST(${JSON.stringify(permissions)} AS jsonb)`;
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;
    if (priority !== undefined) updateData.priority = priority;
    updateData.updated_at = sql`NOW()`;

    const result = await mainDb
      .updateTable('roles')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return result || null;
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
}

export async function deleteRole(id: number) {
  try {
    await mainDb
      .deleteFrom('user_roles')
      .where('role_id', '=', id)
      .execute();

    await mainDb
      .updateTable('users')
      .set({ role_id: undefined })
      .where('role_id', '=', id)
      .execute();

    const result = await mainDb
      .deleteFrom('roles')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return result || null;
  } catch (error) {
    console.error('Error deleting role:', error);
    throw error;
  }
}

export async function assignRoleToUser(userId: string, roleId: number) {
  try {
    await mainDb
      .insertInto('user_roles')
      .values({ user_id: userId, role_id: roleId })
      .onConflict(oc => oc.columns(['user_id', 'role_id']).doNothing())
      .execute();

    const user = await mainDb
      .selectFrom('users')
      .select('role_id')
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user?.role_id) {
      await mainDb
        .updateTable('users')
        .set({ role_id: roleId, updated_at: sql`NOW()` })
        .where('id', '=', userId)
        .execute();
    }

    await invalidateAllUsersCache();

    return { userId, roleId };
  } catch (error) {
    console.error('Error assigning role to user:', error);
    throw error;
  }
}
export async function removeRoleFromUser(userId: string, roleId: number) {
  try {
    await mainDb
      .deleteFrom('user_roles')
      .where('user_id', '=', userId)
      .where('role_id', '=', roleId)
      .execute();

    const user = await mainDb
      .selectFrom('users')
      .select('role_id')
      .where('id', '=', userId)
      .executeTakeFirst();

    if (user?.role_id === roleId) {
      await mainDb
        .updateTable('users')
        .set({ role_id: undefined, updated_at: sql`NOW()` })
        .where('id', '=', userId)
        .execute();
    }

    await invalidateAllUsersCache();

    return { userId, roleId };
  } catch (error) {
    console.error('Error removing role from user:', error);
    throw error;
  }
}

export async function getUserRoles(userId: string) {
  try {
    const result = await mainDb
      .selectFrom('roles as r')
      .innerJoin('user_roles as ur', 'ur.role_id', 'r.id')
      .select([
        'r.id',
        'r.name',
        'r.description',
        'r.permissions',
        'r.color',
        'r.icon',
        'r.priority',
        'r.created_at',
        'r.updated_at'
      ])
      .where('ur.user_id', '=', userId)
      .orderBy('r.priority', 'desc')
      .orderBy('r.created_at', 'desc')
      .execute();

    return result;
  } catch (error) {
    console.error('Error fetching user roles:', error);
    throw error;
  }
}

export async function updateRolePriorities(rolePriorities: { id: number; priority: number }[]) {
  try {
    await mainDb.transaction().execute(async (trx) => {
      for (const { id, priority } of rolePriorities) {
        await trx
          .updateTable('roles')
          .set({ priority, updated_at: sql`NOW()` })
          .where('id', '=', id)
          .execute();
      }
    });
    return true;
  } catch (error) {
    console.error('Error updating role priorities:', error);
    throw error;
  }
}

export async function getUsersWithRoles() {
  try {
    const users = await mainDb
      .selectFrom('users as u')
      .leftJoin('user_roles as ur', 'ur.user_id', 'u.id')
      .select([
        'u.id',
        'u.username',
        'u.avatar',
        'u.created_at',
        'u.role_id'
      ])
      .where(qb =>
        qb.or([
          qb('ur.role_id', 'is not', null),
          qb('u.role_id', 'is not', null)
        ])
      )
      .distinct()
      .orderBy('u.username')
      .execute();

    const userIds = users.map(u => u.id);
    const userRoles = await mainDb
      .selectFrom('user_roles as ur')
      .innerJoin('roles as r', 'ur.role_id', 'r.id')
      .select([
        'ur.user_id',
        'r.id as role_id',
        'r.name',
        'r.color',
        'r.icon',
        'r.priority',
        'r.permissions',
        'r.created_at'
      ])
      .where('ur.user_id', 'in', userIds.length ? userIds : [''])
      .orderBy('r.priority', 'desc')
      .orderBy('r.created_at', 'desc')
      .execute();

    type UserRole = {
      id: number;
      name: string;
      color: string;
      icon: string;
      priority: number;
      permissions: unknown;
    };
    
    const rolesByUser: Record<string, UserRole[]> = {};
    for (const role of userRoles) {
      if (!rolesByUser[role.user_id]) rolesByUser[role.user_id] = [];
      rolesByUser[role.user_id].push({
        id: role.role_id,
        name: role.name,
        color: role.color ?? '#6366F1',
        icon: role.icon ?? 'Star',
        priority: role.priority ?? 0,
        permissions: role.permissions
      });
    }

    const usersWithRoles = users.map(user => {
      const roles = rolesByUser[user.id] || [];
      return {
        ...user,
        is_admin: isAdmin(user.id),
        roles,
        role_name: roles[0]?.name || null,
        role_permissions: roles[0]?.permissions || null
      };
    });

    const allUsers = await mainDb
      .selectFrom('users')
      .select([
        'id',
        'username',
        'avatar',
        'created_at',
        'role_id'
      ])
      .orderBy('username')
      .execute();

    const allRelevantUsers = allUsers
      .filter(user => isAdmin(user.id) || usersWithRoles.find(u => u.id === user.id))
      .map(user => {
        const existing = usersWithRoles.find(u => u.id === user.id);
        if (existing) return existing;
        return {
          ...user,
          is_admin: isAdmin(user.id),
          roles: [],
          role_name: null,
          role_permissions: null
        };
      });

    type UserWithRoles = {
      id: string;
      username: string;
      avatar: string | null;
      created_at: Date;
      role_id: number | null;
      is_admin: boolean;
      roles: UserRole[];
      role_name: string | null;
      role_permissions: unknown;
    };

    const uniqueUsers = allRelevantUsers.reduce((acc: UserWithRoles[], user) => {
      if (!acc.find(u => u.id === user.id)) acc.push(user as UserWithRoles);
      return acc;
    }, []);

    return uniqueUsers.sort((a, b) => a.username.localeCompare(b.username));
  } catch (error) {
    console.error('Error fetching users with roles:', error);
    throw error;
  }
}