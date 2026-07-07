import { z } from "zod";
import { roles, type Role } from "@collabhub/domain";
import { prisma } from "../../plugins/prisma.js";
import { assignRoleByKey, ensureSystemAccess } from "../auth/rbac.seed.js";
import { hashPassword, legacyPasswordHash, temporaryPasswordHashSource } from "../auth/passwords.js";

const statusSchema = z.enum(["free", "busy", "maybe", "stream", "work", "study", "unknown"]).catch("unknown");
const eventStatusSchema = z.enum(["going", "maybe", "no", "invited"]).catch("invited");

const legacyParticipantSchema = z.object({
  id: z.string(),
  name: z.string().default("Participant"),
  color: z.string().default("#55dd78"),
  interests: z.array(z.string()).default([])
});

const legacyAccountSchema = z.object({
  id: z.string().optional(),
  login: z.string().optional(),
  name: z.string().optional(),
  role: z.string().optional(),
  participantId: z.string().nullable().optional(),
  pin: z.string().optional(),
  pinHash: z.string().optional()
});

const legacyTeamSchema = z.object({
  id: z.string(),
  name: z.string().default("Team"),
  color: z.string().default("#9b6cff"),
  leadId: z.string().optional().nullable(),
  members: z.array(z.string()).default([])
});

const legacyPresetSchema = z.object({
  name: z.string().default("Preset"),
  start: z.number().int().min(0).max(24).default(18),
  end: z.number().int().min(0).max(24).default(23),
  status: statusSchema.default("unknown")
});

const legacyEventSchema = z.object({
  title: z.string().default("Event"),
  activity: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  date: z.string().optional(),
  day: z.number().int().optional(),
  start: z.number().int().min(0).max(23).default(20),
  end: z.number().int().min(1).max(24).default(22),
  participantStatus: z.record(z.string()).default({})
});

const legacyStateSchema = z.object({
  participants: z.array(legacyParticipantSchema).default([]),
  accounts: z.array(legacyAccountSchema).default([]),
  teams: z.array(legacyTeamSchema).default([]),
  schedules: z.record(z.array(z.array(z.string()))).default({}),
  dateSchedules: z.record(z.record(z.array(z.string()))).default({}),
  comments: z.record(z.record(z.record(z.string()))).default({}),
  memberPresets: z.record(z.array(legacyPresetSchema)).default({}),
  events: z.array(legacyEventSchema).default([]),
  settings: z.object({ activeDate: z.string().optional() }).passthrough().default({})
});

export type LegacyState = z.infer<typeof legacyStateSchema>;

function normalizeRole(role: string | undefined): Role {
  const raw = String(role || "member").toLowerCase().replace(/[_-]/g, "");
  if (raw === "master") return "master";
  if (raw === "headadmin" || raw === "gladmin") return "head_admin";
  if (raw === "admin") return "admin";
  if (raw === "manager") return "manager";
  if (raw === "teamlead" || raw === "lead") return "teamlead";
  if (raw === "viewer" || raw === "guest") return "viewer";
  return "member";
}

function dayDateFromSettings(state: LegacyState, day: number | undefined) {
  const active = state.settings.activeDate || new Date().toISOString().slice(0, 10);
  const activeDate = new Date(`${active}T00:00:00.000Z`);
  const monday = new Date(activeDate);
  const weekday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(activeDate.getUTCDate() - weekday);
  const eventDate = new Date(monday);
  eventDate.setUTCDate(monday.getUTCDate() + (day ?? 0));
  return eventDate;
}

function toDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function clampHour(hour: number) {
  return Math.max(0, Math.min(23, Math.trunc(hour)));
}

function previewWarnings(state: LegacyState) {
  const warnings: string[] = [];
  const participantIds = new Set(state.participants.map((participant) => participant.id));
  state.accounts.forEach((account) => {
    if (account.participantId && !participantIds.has(account.participantId)) {
      warnings.push(`Account ${account.login ?? account.id ?? "unknown"} references missing participant ${account.participantId}`);
    }
    if (!account.pin && !account.pinHash) {
      warnings.push(`Account ${account.login ?? account.id ?? "unknown"} has no password data and will be imported as invited`);
    }
  });
  state.teams.forEach((team) => {
    team.members.forEach((memberId) => {
      if (!participantIds.has(memberId)) warnings.push(`Team ${team.name} references missing participant ${memberId}`);
    });
  });
  return warnings;
}

export function parseLegacyState(input: unknown) {
  return legacyStateSchema.parse(input);
}

export function previewLegacyImport(input: unknown) {
  const state = parseLegacyState(input);
  const templateSlots = Object.values(state.schedules).reduce((sum, days) => sum + days.reduce((daySum, hours) => daySum + hours.length, 0), 0);
  const datedSlots = Object.values(state.dateSchedules).reduce(
    (sum, dates) => sum + Object.values(dates).reduce((dateSum, hours) => dateSum + hours.length, 0),
    0
  );
  const comments = Object.values(state.comments).reduce(
    (sum, dates) => sum + Object.values(dates).reduce((dateSum, hours) => dateSum + Object.keys(hours).length, 0),
    0
  );
  const presets = Object.values(state.memberPresets).reduce((sum, list) => sum + list.length, 0);
  const eventParticipants = state.events.reduce((sum, event) => sum + Object.keys(event.participantStatus || {}).length, 0);

  return {
    participants: state.participants.length,
    accounts: state.accounts.length,
    teams: state.teams.length,
    templateSlots,
    datedSlots,
    comments,
    presets,
    events: state.events.length,
    eventParticipants,
    warnings: previewWarnings(state)
  };
}

async function passwordHashFor(account: z.infer<typeof legacyAccountSchema>) {
  if (account.pinHash) return legacyPasswordHash(account.pinHash);
  if (account.pin) return hashPassword(account.pin);
  return hashPassword(temporaryPasswordHashSource());
}

export async function importLegacyState(input: unknown, actorUserId: string) {
  const state = parseLegacyState(input);
  const summary = previewLegacyImport(state);
  await ensureSystemAccess();

  const job = await prisma.importJob.create({
    data: {
      createdByUserId: actorUserId,
      status: "pending",
      sourceFormat: "collabhub-static-json",
      summary
    }
  });

  try {
    await prisma.$transaction(async (transaction: typeof prisma) => {
      const db = transaction as typeof prisma;
      const profileByLegacyId = new Map<string, string>();
      const userByLegacyAccountId = new Map<string, string>();
      const userByLegacyParticipantId = new Map<string, string>();

      for (const participant of state.participants) {
        const account = state.accounts.find((item) => item.participantId === participant.id);
        const login = account?.login || account?.name || participant.name || participant.id;
        const role = normalizeRole(account?.role);
        const user = await db.user.upsert({
          where: { login },
          create: {
            login,
            passwordHash: await passwordHashFor(account ?? {}),
            roleKey: role,
            status: account?.pin || account?.pinHash ? "active" : "invited",
            profile: {
              create: {
                displayName: participant.name,
                color: participant.color,
                interests: participant.interests
              }
            },
            preferences: { create: {} }
          },
          update: {
            roleKey: role,
            profile: {
              upsert: {
                create: {
                  displayName: participant.name,
                  color: participant.color,
                  interests: participant.interests
                },
                update: {
                  displayName: participant.name,
                  color: participant.color,
                  interests: participant.interests
                }
              }
            }
          },
          include: { profile: true }
        });
        await assignRoleByKey(user.id, role);
        if (!user.profile) throw new Error(`Profile was not created for ${login}`);
        profileByLegacyId.set(participant.id, user.profile.id);
        userByLegacyParticipantId.set(participant.id, user.id);
        if (account?.id) userByLegacyAccountId.set(account.id, user.id);
      }

      for (const account of state.accounts.filter((item) => !item.participantId)) {
        const login = account.login || account.name || account.id || `legacy_${Date.now()}`;
        const role = normalizeRole(account.role);
        const user = await db.user.upsert({
          where: { login },
          create: {
            login,
            passwordHash: await passwordHashFor(account),
            roleKey: role,
            status: account.pin || account.pinHash ? "active" : "invited"
          },
          update: { roleKey: role }
        });
        await assignRoleByKey(user.id, role);
        if (account.id) userByLegacyAccountId.set(account.id, user.id);
      }

      for (const [legacyId, profileId] of profileByLegacyId) {
        await db.availabilityTemplateSlot.deleteMany({ where: { profileId } });
        const days = state.schedules[legacyId] || [];
        for (let day = 0; day < days.length; day++) {
          const hours = days[day] || [];
          for (let hour = 0; hour < Math.min(hours.length, 24); hour++) {
            await db.availabilityTemplateSlot.create({
              data: { profileId, dayOfWeek: day, hour, status: statusSchema.parse(hours[hour]) }
            });
          }
        }

        await db.availabilitySlot.deleteMany({ where: { profileId } });
        for (const [dateKey, hours] of Object.entries(state.dateSchedules[legacyId] || {})) {
          for (let hour = 0; hour < Math.min(hours.length, 24); hour++) {
            await db.availabilitySlot.create({
              data: { profileId, date: toDate(dateKey), hour, status: statusSchema.parse(hours[hour]) }
            });
          }
        }

        await db.availabilityComment.deleteMany({ where: { profileId } });
        for (const [dateKey, hours] of Object.entries(state.comments[legacyId] || {})) {
          for (const [hour, body] of Object.entries(hours)) {
            if (!String(body).trim()) continue;
            await db.availabilityComment.create({
              data: { profileId, date: toDate(dateKey), hour: clampHour(Number(hour)), body }
            });
          }
        }

        await db.availabilityPreset.deleteMany({ where: { profileId } });
        for (const preset of state.memberPresets[legacyId] || []) {
          await db.availabilityPreset.create({
            data: {
              profileId,
              name: preset.name,
              startHour: preset.start,
              endHour: preset.end,
              status: preset.status
            }
          });
        }
      }

      const teamByLegacyId = new Map<string, string>();
      for (const legacyTeam of state.teams) {
        const leadProfileId = legacyTeam.leadId ? profileByLegacyId.get(legacyTeam.leadId) : null;
        const team = await db.team.create({
          data: {
            name: legacyTeam.name,
            color: legacyTeam.color,
            leadProfileId
          }
        });
        teamByLegacyId.set(legacyTeam.id, team.id);
        for (const memberId of legacyTeam.members) {
          const profileId = profileByLegacyId.get(memberId);
          if (!profileId) continue;
          await db.teamMember.upsert({
            where: { teamId_profileId: { teamId: team.id, profileId } },
            create: { teamId: team.id, profileId },
            update: {}
          });
        }
      }

      const fallbackCreator = userByLegacyParticipantId.values().next().value || actorUserId;
      for (const event of state.events) {
        const participantIds = Object.keys(event.participantStatus || {});
        const firstParticipantId = participantIds[0];
        const createdByUserId = firstParticipantId ? userByLegacyParticipantId.get(firstParticipantId) ?? fallbackCreator : fallbackCreator;
        const created = await db.event.create({
          data: {
            title: event.title,
            activity: event.activity || null,
            description: event.description || null,
            date: event.date ? toDate(event.date) : dayDateFromSettings(state, event.day),
            startHour: event.start,
            endHour: event.end,
            createdByUserId,
            teamId: state.teams[0]?.id ? teamByLegacyId.get(state.teams[0].id) ?? null : null,
            visibility: "community"
          }
        });
        for (const [legacyParticipantId, rawStatus] of Object.entries(event.participantStatus || {})) {
          const profileId = profileByLegacyId.get(legacyParticipantId);
          if (!profileId) continue;
          await db.eventParticipant.upsert({
            where: { eventId_profileId: { eventId: created.id, profileId } },
            create: { eventId: created.id, profileId, status: eventStatusSchema.parse(rawStatus) },
            update: { status: eventStatusSchema.parse(rawStatus) }
          });
        }
      }
    });

    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "imported", finishedAt: new Date(), summary }
    });
    return { jobId: job.id, summary };
  } catch (error) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "failed", finishedAt: new Date(), error: error instanceof Error ? error.message : "Unknown import error" }
    });
    throw error;
  }
}
