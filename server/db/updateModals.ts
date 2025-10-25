import { mainDb } from "./connection.js";
import { sql } from "kysely";
import type { UpdateModalsTable } from "./types/connection/main/UpdateModalsTable.js";

export async function getActiveUpdateModal() {
  const modal = await mainDb
    .selectFrom("update_modals")
    .selectAll()
    .where("is_active", "=", true)
    .orderBy("published_at", "desc")
    .executeTakeFirst();

  return modal || null;
}

export async function getAllUpdateModals() {
  const modals = await mainDb
    .selectFrom("update_modals")
    .selectAll()
    .orderBy("created_at", "desc")
    .execute();

  return modals;
}

export async function getUpdateModalById(id: number) {
  const modal = await mainDb
    .selectFrom("update_modals")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  return modal || null;
}

export async function createUpdateModal(data: {
  title: string;
  content: string;
  banner_url?: string;
}) {
  const modal = await mainDb
    .insertInto("update_modals")
    .values({
      title: data.title,
      content: data.content,
      banner_url: data.banner_url || undefined,
      is_active: false,
      created_at: sql`NOW()`,
      updated_at: sql`NOW()`,
    })
    .returningAll()
    .executeTakeFirst();

  return modal;
}

export async function updateUpdateModal(
  id: number,
  data: {
    title?: string;
    content?: string;
    banner_url?: string;
  }
) {
  const modal = await mainDb
    .updateTable("update_modals")
    .set({
      ...data,
      updated_at: sql`NOW()`,
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  return modal;
}

export async function deleteUpdateModal(id: number) {
  await mainDb
    .deleteFrom("update_modals")
    .where("id", "=", id)
    .execute();
}

export async function publishUpdateModal(id: number) {
  // First, deactivate all other modals
  await mainDb
    .updateTable("update_modals")
    .set({ is_active: false })
    .where("is_active", "=", true)
    .execute();

  // Then activate this modal and set published_at
  const modal = await mainDb
    .updateTable("update_modals")
    .set({
      is_active: true,
      published_at: sql`NOW()`,
      updated_at: sql`NOW()`,
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  // Note: Users will see this modal based on localStorage tracking
  // Each user's browser tracks which modal IDs they've seen

  return modal;
}

export async function unpublishUpdateModal(id: number) {
  const modal = await mainDb
    .updateTable("update_modals")
    .set({
      is_active: false,
      updated_at: sql`NOW()`,
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  return modal;
}
