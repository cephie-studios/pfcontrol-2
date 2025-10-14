import { mainDb } from "./connection";
import { sql } from "kysely";

export async function addTester(
  userId: string,
  username: string,
  addedBy: string,
  addedByUsername: string,
  notes: string = ""
) {
  const result = await mainDb
    .insertInto("testers")
    .values({
      id: sql`NOW()`,
      user_id: userId,
      username,
      added_by: addedBy,
      added_by_username: addedByUsername,
      notes,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column("user_id").doUpdateSet({
        username,
        notes,
        updated_at: new Date(),
      })
    )
    .returningAll()
    .executeTakeFirst();

  return result;
}

export async function removeTester(userId: string) {
  const result = await mainDb
    .deleteFrom("testers")
    .where("user_id", "=", userId)
    .returningAll()
    .executeTakeFirst();

  return result;
}

export async function isTester(userId: string) {
  const result = await mainDb
    .selectFrom("testers")
    .select("id")
    .where("user_id", "=", userId)
    .executeTakeFirst();

  return !!result;
}

export async function getAllTesters(
  page: number = 1,
  limit: number = 50,
  search: string = ""
) {
  const offset = (page - 1) * limit;
  let query = mainDb
    .selectFrom("testers as t")
    .leftJoin("users as u", "t.user_id", "u.id")
    .select([
      "t.id",
      "t.user_id",
      "t.username",
      "t.added_by",
      "t.added_by_username",
      "t.notes",
      "t.created_at",
      "t.updated_at",
      "u.avatar as avatar",
    ])
    .orderBy("t.created_at", "desc")
    .limit(limit)
    .offset(offset);

  if (search && search.trim()) {
    query = query.where((eb) =>
      eb.or([
        eb("t.username", "ilike", `%${search.trim()}%`),
        eb("t.user_id", "=", search.trim()),
      ])
    );
  }

  const testers = await query.execute();

  let countQuery = mainDb.selectFrom("testers as t").select(({ fn }) => [fn.countAll().as("count")]);
  if (search && search.trim()) {
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb("t.username", "ilike", `%${search.trim()}%`),
        eb("t.user_id", "=", search.trim()),
      ])
    );
  }
  const countResult = await countQuery.executeTakeFirst();
  const total = Number(countResult?.count ?? 0);

  return {
    testers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getTesterSettings() {
  const rows = await mainDb
    .selectFrom("tester_settings")
    .select(["setting_key", "setting_value"])
    .execute();

  const settings: Record<string, boolean> = {};
  for (const row of rows) {
    settings[row.setting_key] = row.setting_value;
  }
  if (!("tester_gate_enabled" in settings)) {
    settings["tester_gate_enabled"] = true;
  }
  return settings;
}

export async function updateTesterSetting(key: string, value: boolean) {
  await mainDb
    .insertInto("tester_settings")
    .values({
      id: sql`DEFAULT`,
      setting_key: key,
      setting_value: value,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column("setting_key").doUpdateSet({
        setting_value: value,
        updated_at: new Date(),
      })
    )
    .execute();

  return { [key]: value };
}