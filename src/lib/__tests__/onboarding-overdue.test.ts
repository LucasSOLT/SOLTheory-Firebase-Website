import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockCreateNotification, mockSendOnboardingEmail } = vi.hoisted(() => ({
  mockCreateNotification: vi.fn().mockResolvedValue(1),
  mockSendOnboardingEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('googleapis', () => ({
  google: {},
}));

vi.mock('@/lib/notifications', () => ({
  createNotification: mockCreateNotification,
  dashboardPath: (orgId: string, section: string) => `/portal/dashboard/${orgId}/${section}`,
}));

vi.mock('@/lib/onboarding-mailer', async () => {
  const actual = await vi.importActual<typeof import('@/lib/onboarding-mailer')>(
    '@/lib/onboarding-mailer',
  );
  return {
    ...actual,
    sendOnboardingEmail: mockSendOnboardingEmail,
  };
});

import {
  toMs,
  isTaskOverdue,
  shouldMarkCompletedLate,
  isTaskCompletedLate,
  planOverdueTask,
  resolveOverdueRecipients,
  runOnboardingOverdue,
} from '@/lib/onboarding-overdue';
import {
  hasValidCronSecret,
  GET as cronGet,
  POST as cronPost,
} from '@/app/api/onboarding/cron/overdue/route';
import { GET as nudgesGet } from '@/app/api/onboarding/cron/nudges/route';
import { NextRequest } from 'next/server';

// ── In-memory Firestore mock for sweep testing ──────────────────────────────

function createMockDb(seed: {
  orgs?: Record<string, any>;
  users?: Record<string, any>;
  onboarding_instances?: Record<string, any>;
  action_board_tasks?: Record<string, any>;
  email_dispatch_log?: Record<string, any>;
}) {
  const store: Record<string, Record<string, any>> = {
    orgs: { ...(seed.orgs || {}) },
    users: { ...(seed.users || {}) },
    onboarding_instances: { ...(seed.onboarding_instances || {}) },
    action_board_tasks: { ...(seed.action_board_tasks || {}) },
    email_dispatch_log: { ...(seed.email_dispatch_log || {}) },
  };
  const deletedDocs: string[] = [];

  function applyDotUpdates(target: Record<string, any>, updates: Record<string, any>) {
    for (const [k, v] of Object.entries(updates)) {
      if (k.includes('.')) {
        const parts = k.split('.');
        let cur = target;
        for (let i = 0; i < parts.length - 1; i++) {
          const p = parts[i];
          if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
          cur = cur[p];
        }
        cur[parts[parts.length - 1]] = v;
      } else {
        target[k] = v;
      }
    }
  }

  function makeDocRef(colName: string, id: string) {
    return {
      id,
      path: `${colName}/${id}`,
      async get() {
        const data = store[colName]?.[id];
        return {
          id,
          exists: data !== undefined,
          data: () => (data !== undefined ? structuredClone(data) : undefined),
          ref: makeDocRef(colName, id),
        };
      },
      async set(data: any) {
        if (!store[colName]) store[colName] = {};
        store[colName][id] = structuredClone(data);
      },
      async create(data: any) {
        if (!store[colName]) store[colName] = {};
        if (store[colName][id] !== undefined) {
          const err: any = new Error('Document already exists');
          err.code = 6;
          throw err;
        }
        store[colName][id] = structuredClone(data);
      },
      async update(updates: Record<string, any>) {
        if (!store[colName] || store[colName][id] === undefined) {
          throw new Error(`Document ${colName}/${id} does not exist`);
        }
        applyDotUpdates(store[colName][id], updates);
      },
      async delete() {
        deletedDocs.push(`${colName}/${id}`);
        if (store[colName]) {
          delete store[colName][id];
        }
      },
    };
  }

  function getField(obj: any, fieldPath: string): any {
    return fieldPath.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
  }

  function makeQuery(
    colName: string,
    filters: Array<{ field: string; op: string; value: any }> = [],
  ): any {
    return {
      where(field: string, op: string, value: any) {
        return makeQuery(colName, [...filters, { field, op, value }]);
      },
      async get() {
        const col = store[colName] || {};
        const docs = Object.entries(col)
          .filter(([, data]) =>
            filters.every((f) => {
              const actual = getField(data, f.field);
              if (f.op === '==') return actual === f.value;
              return false;
            }),
          )
          .map(([id, data]) => ({
            id,
            exists: true,
            data: () => structuredClone(data),
            ref: makeDocRef(colName, id),
          }));
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }

  return {
    store,
    deletedDocs,
    collection(colName: string) {
      return {
        ...makeQuery(colName),
        doc(id: string) {
          return makeDocRef(colName, id);
        },
      };
    },
    doc(path: string) {
      const [colName, id] = path.split('/');
      return makeDocRef(colName, id);
    },
  };
}

describe('Phase I7 — Onboarding Overdue & Late Completion', () => {
  const NOW = new Date('2026-10-14T18:00:00.000Z').getTime();
  const PAST_DUE = NOW - 3_600_000; // 1 hour ago
  const FUTURE_DUE = NOW + 86_400_000; // 1 day in future

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNotification.mockResolvedValue(1);
    mockSendOnboardingEmail.mockResolvedValue({ ok: true });
  });

  describe('toMs & pure overdue / late-completion predicates', () => {
    it('converts timestamps, Dates, ISO strings, and numbers safely', () => {
      expect(toMs(null)).toBe(0);
      expect(toMs(undefined)).toBe(0);
      expect(toMs('not-a-date')).toBe(0);
      expect(toMs(NOW)).toBe(NOW);
      expect(toMs(new Date(NOW))).toBe(NOW);
      expect(toMs(new Date(NOW).toISOString())).toBe(NOW);
      expect(toMs({ toMillis: () => NOW })).toBe(NOW);
      expect(toMs({ seconds: Math.floor(NOW / 1000) })).toBe(Math.floor(NOW / 1000) * 1000);
    });

    it('identifies overdue tasks accurately without flagging done, archived, pending_review, or uploaded compliance doc tasks', () => {
      expect(isTaskOverdue({ column: 'todo', dueDate: PAST_DUE }, NOW)).toBe(true);
      expect(isTaskOverdue({ column: 'doing', dueDate: FUTURE_DUE, isLate: true }, NOW)).toBe(true);
      expect(isTaskOverdue({ column: 'todo', dueDate: FUTURE_DUE }, NOW)).toBe(false);
      expect(isTaskOverdue({ column: 'done', dueDate: PAST_DUE, isLate: true }, NOW)).toBe(false);
      expect(isTaskOverdue({ column: 'todo', dueDate: PAST_DUE, isArchived: true }, NOW)).toBe(false);
      expect(
        isTaskOverdue(
          { column: 'todo', dueDate: PAST_DUE, metadata: { reviewStatus: 'pending_review' } },
          NOW,
        ),
      ).toBe(false);
      // Compliance document uploaded and awaiting verification is not overdue
      expect(
        isTaskOverdue(
          {
            column: 'todo',
            dueDate: PAST_DUE,
            attachments: [{ url: 'https://example.com/w4.pdf', name: 'w4.pdf', type: 'document' }],
            metadata: { requiresDocumentUpload: true },
          },
          NOW,
        ),
      ).toBe(false);
      expect(
        planOverdueTask(
          {
            category: 'onboarding',
            column: 'todo',
            dueDate: PAST_DUE,
            attachments: [{ url: 'https://example.com/w4.pdf', name: 'w4.pdf', type: 'document' }],
            metadata: { requiresDocumentUpload: true },
          },
          NOW,
        ).reason,
      ).toBe('pending_review');
      // If compliance doc was rejected and dueDate passed, it IS overdue again
      expect(
        isTaskOverdue(
          {
            column: 'todo',
            dueDate: PAST_DUE,
            attachments: [{ url: 'https://example.com/w4.pdf', name: 'w4.pdf', type: 'document' }],
            metadata: {
              requiresDocumentUpload: true,
              documentVerificationStatus: 'rejected',
            },
          },
          NOW,
        ),
      ).toBe(true);
    });

    it('labels late completions as "Completed late" while not penalizing on-time submissions approved late', () => {
      // Direct completion after dueDate → completed late
      const lateTask = {
        column: 'done',
        dueDate: PAST_DUE,
        completedAt: NOW,
      };
      expect(shouldMarkCompletedLate(lateTask, NOW)).toBe(true);
      expect(isTaskCompletedLate(lateTask)).toBe(true);

      // Direct completion before dueDate → on time
      const onTimeTask = {
        column: 'done',
        dueDate: FUTURE_DUE,
        completedAt: NOW,
      };
      expect(shouldMarkCompletedLate(onTimeTask, NOW)).toBe(false);
      expect(isTaskCompletedLate(onTimeTask)).toBe(false);

      // Submitted BEFORE dueDate, approved by supervisor AFTER dueDate → NOT completed late
      const submittedOnTimeApprovedLate = {
        column: 'done',
        dueDate: PAST_DUE,
        completedAt: NOW, // approved after dueDate
        metadata: {
          reviewStatus: 'approved',
          submittedAt: PAST_DUE - 10_000, // submitted before dueDate
        },
      };
      expect(shouldMarkCompletedLate(submittedOnTimeApprovedLate, NOW)).toBe(false);
      expect(isTaskCompletedLate(submittedOnTimeApprovedLate)).toBe(false);

      // Resubmission after a rejected on-time attempt past dueDate → completed late when ignoreExistingSubmittedAt is set
      const resubmittedLateAfterRejection = {
        column: 'todo',
        dueDate: PAST_DUE,
        metadata: {
          reviewStatus: 'rejected',
          submittedAt: PAST_DUE - 10_000, // stale timestamp from earlier rejected attempt
        },
      };
      expect(
        shouldMarkCompletedLate(resubmittedLateAfterRejection, NOW, {
          ignoreExistingSubmittedAt: true,
        }),
      ).toBe(true);

      // Submitted AFTER dueDate, approved by supervisor later → completed late
      const submittedLateApprovedLater = {
        column: 'todo',
        dueDate: PAST_DUE,
        isLate: true,
        metadata: {
          reviewStatus: 'pending_review',
          submittedAt: PAST_DUE + 10_000,
        },
      };
      expect(shouldMarkCompletedLate(submittedLateApprovedLater, NOW)).toBe(true);

      // Explicit reset after Re-Request (`metadata.completedLate: false`)
      expect(
        isTaskCompletedLate({
          column: 'done',
          dueDate: PAST_DUE,
          isLate: true,
          metadata: { completedLate: false },
        }),
      ).toBe(false);
    });

    it('planOverdueTask distinguishes mark_and_notify, notify_only, and already_processed', () => {
      const freshOverdue = {
        category: 'onboarding',
        column: 'todo',
        dueDate: PAST_DUE,
        metadata: {},
      };
      expect(planOverdueTask(freshOverdue, NOW)).toEqual({
        overdue: true,
        shouldMark: true,
        shouldNotify: true,
        reason: 'mark_and_notify',
        dueMs: PAST_DUE,
        overdueByMs: NOW - PAST_DUE,
      });

      // Even if client-side Action Board set isLate: true, server still notifies if overdueNotifiedAt is unset
      const clientMarkedOnly = {
        category: 'onboarding',
        column: 'todo',
        dueDate: PAST_DUE,
        isLate: true,
        metadata: { overdue: true, overdueAt: PAST_DUE + 1000 },
      };
      expect(planOverdueTask(clientMarkedOnly, NOW)).toEqual({
        overdue: true,
        shouldMark: false,
        shouldNotify: true,
        reason: 'notify_only',
        dueMs: PAST_DUE,
        overdueByMs: NOW - PAST_DUE,
      });

      const fullyProcessed = {
        category: 'onboarding',
        column: 'todo',
        dueDate: PAST_DUE,
        isLate: true,
        metadata: {
          overdue: true,
          overdueAt: PAST_DUE + 1000,
          overdueNotifiedAt: PAST_DUE + 2000,
        },
      };
      expect(planOverdueTask(fullyProcessed, NOW).reason).toBe('already_processed');
    });
  });

  describe('resolveOverdueRecipients', () => {
    it('prefers supervisorUid/supervisorEmail and falls back to legacy mentorUid/mentorEmail', async () => {
      const db = createMockDb({
        users: {
          'sup-new': { email: 'sup-new@example.com', displayName: 'New Supervisor' },
          'sup-legacy': { email: 'sup-legacy@example.com', displayName: 'Legacy Mentor' },
        },
      });

      const withNewFields = await resolveOverdueRecipients(
        db as any,
        {
          userId: 'emp-1',
          userEmail: 'emp1@example.com',
          userName: 'Alice Employee',
          supervisorUid: 'sup-new',
          mentorUid: 'sup-legacy',
        },
        {},
      );
      expect(withNewFields.employee).toEqual({
        uid: 'emp-1',
        email: 'emp1@example.com',
        name: 'Alice Employee',
      });
      expect(withNewFields.supervisor).toEqual({
        uid: 'sup-new',
        email: 'sup-new@example.com',
        name: 'New Supervisor',
      });

      const withLegacyFields = await resolveOverdueRecipients(
        db as any,
        {
          userId: 'emp-1',
          userEmail: 'emp1@example.com',
          userName: 'Alice Employee',
          mentorUid: 'sup-legacy',
        },
        {},
      );
      expect(withLegacyFields.supervisor).toEqual({
        uid: 'sup-legacy',
        email: 'sup-legacy@example.com',
        name: 'Legacy Mentor',
      });
    });
  });

  describe('runOnboardingOverdue', () => {
    it('marks overdue items without deleting or archiving anything and sends bell + email once to employee and supervisor', async () => {
      const db = createMockDb({
        orgs: {
          org1: { onboardingEmailsEnabled: true },
        },
        users: {
          'sup-1': { email: 'supervisor@example.com', displayName: 'Sam Supervisor' },
        },
        onboarding_instances: {
          inst1: {
            id: 'inst1',
            orgId: 'org1',
            status: 'in_progress',
            userId: 'emp-1',
            userEmail: 'employee@example.com',
            userName: 'Alex Rivera',
            roleName: 'Case Manager',
            supervisorUid: 'sup-1',
            supervisorEmail: 'supervisor@example.com',
          },
        },
        action_board_tasks: {
          task_overdue: {
            id: 'task_overdue',
            orgId: 'org1',
            category: 'onboarding',
            title: 'Complete HIPAA Quiz',
            column: 'todo',
            dueDate: PAST_DUE,
            isArchived: false,
            isLate: false,
            assignedTo: 'emp-1',
            assignedToEmail: 'employee@example.com',
            metadata: {
              onboardingInstanceId: 'inst1',
              phase: 1,
            },
          },
          task_future: {
            id: 'task_future',
            orgId: 'org1',
            category: 'onboarding',
            title: 'Shadowing Session',
            column: 'todo',
            dueDate: FUTURE_DUE,
            isArchived: false,
            isLate: false,
            assignedTo: 'emp-1',
            assignedToEmail: 'employee@example.com',
            metadata: {
              onboardingInstanceId: 'inst1',
              phase: 2,
            },
          },
          task_done: {
            id: 'task_done',
            orgId: 'org1',
            category: 'onboarding',
            title: 'Sign Offer Letter',
            column: 'done',
            dueDate: PAST_DUE,
            isArchived: false,
            isLate: false,
            assignedTo: 'emp-1',
            assignedToEmail: 'employee@example.com',
            metadata: {
              onboardingInstanceId: 'inst1',
              phase: 1,
            },
          },
        },
      });

      // First run: marks task_overdue and notifies both employee and supervisor
      const res1 = await runOnboardingOverdue(db as any, { nowMs: NOW });
      expect(res1.instancesScanned).toBe(1);
      expect(res1.tasksScanned).toBe(3);
      expect(res1.markedOverdue).toBe(1);
      expect(res1.notified).toBe(1);
      expect(res1.errors).toBe(0);

      // Nothing was deleted or archived
      expect(db.deletedDocs).toHaveLength(0);
      const updatedTask = db.store.action_board_tasks.task_overdue;
      expect(updatedTask).toBeDefined();
      expect(updatedTask.isArchived).toBe(false);
      expect(updatedTask.isLate).toBe(true);
      expect(updatedTask.metadata.overdue).toBe(true);
      expect(updatedTask.metadata.overdueAt).toBe(NOW);
      expect(updatedTask.metadata.overdueNotifiedAt).toBe(NOW);

      // 2 bell notifications (employee + supervisor) and 2 emails (employee + supervisor)
      expect(mockCreateNotification).toHaveBeenCalledTimes(2);
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUids: ['emp-1'],
          type: 'onboarding_item_overdue',
          refId: 'task_overdue',
          dedupeKey: 'onb-overdue-emp-task_overdue',
        }),
      );
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUids: ['sup-1'],
          type: 'onboarding_item_overdue',
          refId: 'task_overdue',
          dedupeKey: 'onb-overdue-sup-task_overdue',
        }),
      );

      expect(mockSendOnboardingEmail).toHaveBeenCalledTimes(2);
      expect(mockSendOnboardingEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org1',
          to: 'employee@example.com',
        }),
      );
      expect(mockSendOnboardingEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org1',
          to: 'supervisor@example.com',
        }),
      );

      // Second run: idempotent — zero new marks, zero new notifications/emails
      mockCreateNotification.mockClear();
      mockSendOnboardingEmail.mockClear();

      const res2 = await runOnboardingOverdue(db as any, { nowMs: NOW + 60_000 });
      expect(res2.markedOverdue).toBe(0);
      expect(res2.notified).toBe(0);
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(mockSendOnboardingEmail).not.toHaveBeenCalled();
    });

    it('retries notification on next run if an email fails, without re-sending already delivered emails', async () => {
      const db = createMockDb({
        orgs: { org1: { onboardingEmailsEnabled: true } },
        onboarding_instances: {
          inst1: {
            id: 'inst1',
            orgId: 'org1',
            status: 'in_progress',
            userId: 'emp-1',
            userEmail: 'employee@example.com',
            userName: 'Alex Rivera',
            mentorUid: 'sup-1',
            mentorEmail: 'supervisor@example.com',
          },
        },
        action_board_tasks: {
          task1: {
            id: 'task1',
            orgId: 'org1',
            category: 'onboarding',
            title: 'Upload I-9',
            column: 'todo',
            dueDate: PAST_DUE,
            isArchived: false,
            isLate: false,
            metadata: { onboardingInstanceId: 'inst1', phase: 1 },
          },
        },
      });

      // Employee email succeeds, supervisor email fails on run 1
      mockSendOnboardingEmail
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, reason: 'sendgrid_error' });

      const res1 = await runOnboardingOverdue(db as any, { nowMs: NOW });
      expect(res1.markedOverdue).toBe(1);
      expect(res1.notified).toBe(0);
      expect(db.store.action_board_tasks.task1.isLate).toBe(true);
      expect(db.store.action_board_tasks.task1.metadata.overdue).toBe(true);
      expect(db.store.action_board_tasks.task1.metadata.overdueNotifiedAt).toBeUndefined();

      // Run 2: employee email is skipped via email_dispatch_log, supervisor email is retried and succeeds
      mockSendOnboardingEmail.mockReset().mockResolvedValue({ ok: true });
      const res2 = await runOnboardingOverdue(db as any, { nowMs: NOW + 60_000 });
      expect(res2.markedOverdue).toBe(0);
      expect(res2.notified).toBe(1);
      expect(mockSendOnboardingEmail).toHaveBeenCalledTimes(1);
      expect(mockSendOnboardingEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'supervisor@example.com' }),
      );
      expect(db.store.action_board_tasks.task1.metadata.overdueNotifiedAt).toBe(NOW + 60_000);
    });
  });

  describe('/api/onboarding/cron/overdue — fail-closed security', () => {
    const originalCronSecret = process.env.CRON_SECRET;

    afterEach(() => {
      if (originalCronSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = originalCronSecret;
      }
    });

    it('fails closed when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;
      const req = new NextRequest('http://localhost/api/onboarding/cron/overdue', {
        headers: { authorization: 'Bearer anything' },
      });
      expect(hasValidCronSecret(req)).toBe(false);
      const res = await cronGet(req);
      expect(res.status).toBe(401);
    });

    it('fails closed when Bearer token is missing or wrong', async () => {
      process.env.CRON_SECRET = 'super-secret-cron-token';
      const missingHeaderReq = new NextRequest('http://localhost/api/onboarding/cron/overdue');
      expect(hasValidCronSecret(missingHeaderReq)).toBe(false);
      expect((await cronGet(missingHeaderReq)).status).toBe(401);

      const wrongTokenReq = new NextRequest('http://localhost/api/onboarding/cron/overdue', {
        headers: { authorization: 'Bearer wrong-token' },
      });
      expect(hasValidCronSecret(wrongTokenReq)).toBe(false);
      expect((await cronGet(wrongTokenReq)).status).toBe(401);
    });

    it('accepts a valid CRON_SECRET bearer token', () => {
      process.env.CRON_SECRET = 'super-secret-cron-token';
      const validReq = new NextRequest('http://localhost/api/onboarding/cron/overdue', {
        headers: { authorization: 'Bearer super-secret-cron-token' },
      });
      expect(hasValidCronSecret(validReq)).toBe(true);
    });

    it('nudges cron GET also fails closed in non-production when CRON_SECRET is missing or mismatched', async () => {
      delete process.env.CRON_SECRET;
      const req1 = new NextRequest('http://localhost/api/onboarding/cron/nudges');
      expect((await nudgesGet(req1)).status).toBe(401);

      process.env.CRON_SECRET = 'expected-secret';
      const req2 = new NextRequest('http://localhost/api/onboarding/cron/nudges', {
        headers: { authorization: 'Bearer wrong-secret' },
      });
      expect((await nudgesGet(req2)).status).toBe(401);
    });

    it('overdue cron POST fails closed when neither CRON_SECRET nor user auth is provided', async () => {
      delete process.env.CRON_SECRET;
      const req = new NextRequest('http://localhost/api/onboarding/cron/overdue', {
        method: 'POST',
        body: JSON.stringify({ orgId: 'org1' }),
      });
      const res = await cronPost(req);
      expect(res.status).toBe(401);
    });
  });

  describe('mergeNotifications — overdue deduplication', () => {
    it('suppresses computed task-overdue-{taskId} when persisted onboarding_item_overdue exists for that taskId', async () => {
      const { mergeNotifications } = await import('@/stores/notification-store');
      const merged = mergeNotifications(
        [
          {
            id: 'onb-overdue-emp-task_123_emp1',
            type: 'onboarding_item_overdue',
            title: 'Onboarding item overdue',
            body: '"Complete HIPAA Quiz" is past its due date.',
            refId: 'task_123',
            createdAt: NOW,
            read: false,
          },
        ],
        [
          {
            id: 'task-overdue-task_123',
            title: 'Task Overdue',
            desc: 'Complete HIPAA Quiz is overdue',
            time: NOW - 1000,
          },
          {
            id: 'task-overdue-task_other',
            title: 'Task Overdue',
            desc: 'Other task is overdue',
            time: NOW - 2000,
          },
        ],
      );

      expect(merged.map((n) => n.id)).toEqual([
        'onb-overdue-emp-task_123_emp1',
        'task-overdue-task_other',
      ]);
    });
  });
});
