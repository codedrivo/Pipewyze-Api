const moment = require('moment-timezone');
const User = require('../models/user.model');
const Subscription = require('../models/subscription.model');
const Notification = require('../models/notification.model');
const notificationService = require('./notification.service');
const logger = require('../config/logger');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TRIAL_DURATION_MS = 7 * MS_PER_DAY;

/**
 * Sends daily countdown reminders to freemium users in their 7-day trial,
 * and a one-time notice when the trial expires on Day 8.
 */
const sendFreemiumTrialReminders = async () => {
  const now = new Date();
  const startOfToday = moment().startOf('day').toDate();

  // 1. Exclude users who have an active, trialing, or canceled paid subscription
  const [nonFreemiumSubs, sentToday, sentExpiredRecent] = await Promise.all([
    Subscription.find({
      status: { $in: ['active', 'trialing', 'canceled'] },
    })
      .select('userId')
      .lean(),
    Notification.find({
      'data.event': 'trial_reminder',
      createdAt: { $gte: startOfToday },
    })
      .sort({ createdAt: -1 })
      .select('userId data')
      .lean(),
    Notification.find({
      'data.event': 'trial_expired',
      createdAt: { $gte: new Date(now.getTime() - MS_PER_DAY) },
    })
      .sort({ createdAt: -1 })
      .select('userId createdAt')
      .lean(),
  ]);

  const excludedUserIds = new Set(
    nonFreemiumSubs.map((s) => s.userId.toString()),
  );
  const notifiedTodayDaysMap = {};
  sentToday.forEach((n) => {
    const uidStr = n.userId.toString();
    if (notifiedTodayDaysMap[uidStr] === undefined) {
      const daysVal = n.data?.daysRemaining ?? n.data?.get?.('daysRemaining');
      notifiedTodayDaysMap[uidStr] = daysVal !== undefined ? String(daysVal) : null;
    }
  });
  const latestExpiredNoticeMap = {};
  sentExpiredRecent.forEach((n) => {
    const uidStr = n.userId.toString();
    if (!latestExpiredNoticeMap[uidStr]) {
      latestExpiredNoticeMap[uidStr] = new Date(n.createdAt);
    }
  });

  // 2. Find all non-admin freemium users
  const freemiumUsers = await User.find({
    role: { $ne: 'admin' },
    $or: [
      { subscriptionTier: 'freemium' },
      { subscriptionTier: { $exists: false } },
      { subscriptionTier: null },
    ],
  })
    .select('_id fullName email createdAt trialStartDate trialEndDate')
    .lean();

  let reminderCount = 0;
  let expiredNoticeCount = 0;

  for (const user of freemiumUsers) {
    const uid = user._id.toString();
    if (excludedUserIds.has(uid)) continue;

    const trialStart = user.trialStartDate
      ? new Date(user.trialStartDate)
      : user.createdAt
      ? new Date(user.createdAt)
      : now;
    const trialEnd = user.trialEndDate
      ? new Date(user.trialEndDate)
      : new Date(trialStart.getTime() + TRIAL_DURATION_MS);

    const msRemaining = trialEnd.getTime() - now.getTime();

    if (msRemaining > 0) {
      const daysRemaining = Math.max(1, Math.ceil(msRemaining / MS_PER_DAY));
      if (daysRemaining > 7) continue;

      if (notifiedTodayDaysMap[uid] === String(daysRemaining)) continue;

      const title =
        daysRemaining === 1
          ? 'Free Trial Ending Tomorrow!'
          : `Free Trial Reminder: ${daysRemaining} Days Left`;
      const body =
        daysRemaining === 1
          ? 'Only 1 day is left in your free trial. Upgrade to Standard or Professional plan to keep uninterrupted access.'
          : `Only ${daysRemaining} days are left in your free trial. Upgrade to Standard or Professional plan to continue without interruption.`;

      try {
        await notificationService.sendToUsers([uid], title, body, {
          type: 'system',
          event: 'trial_reminder',
          action: 'upgrade_plan',
          daysRemaining: String(daysRemaining),
        });
        reminderCount += 1;
      } catch (err) {
        logger.error(
          `[TrialReminder] Failed sending reminder to user ${uid}: ${err.message}`,
        );
      }
    } else if (msRemaining > -MS_PER_DAY) {
      const lastExpiredAt = latestExpiredNoticeMap[uid];
      if (lastExpiredAt && lastExpiredAt >= trialEnd) continue;
      // Trial just expired (within the last 24 hours / Day 8)
      const title = 'Your 7-Day Free Trial Has Ended';
      const body =
        'Your 7-day free trial has expired. Please choose a Standard or Professional plan to continue.';

      try {
        await notificationService.sendToUsers([uid], title, body, {
          type: 'system',
          event: 'trial_expired',
          action: 'upgrade_plan',
          daysRemaining: '0',
        });
        expiredNoticeCount += 1;
      } catch (err) {
        logger.error(
          `[TrialReminder] Failed sending expiration notice to user ${uid}: ${err.message}`,
        );
      }
    }
  }

  logger.info(
    `[TrialReminder] Completed: ${reminderCount} countdown reminder(s) and ${expiredNoticeCount} expiration notice(s) sent.`,
  );

  return {
    reminderCount,
    expiredNoticeCount,
    totalSent: reminderCount + expiredNoticeCount,
  };
};

module.exports = {
  sendFreemiumTrialReminders,
};

