"use strict";
// functions/src/notifications/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRecordSubjectChange = exports.deleteOldNotifications = exports.markAllNotificationsAsRead = exports.markNotificationAsRead = exports.getRecordDisplayName = exports.getUserDisplayName = exports.createNotificationForMultiple = exports.createNotification = void 0;
/**
 * Notifications Module
 *
 * Central export point for all notification-related functionality.
 *
 * Structure:
 * - notificationUtils.ts  → Shared types, helpers, createNotification()
 * - triggers/             → Firestore triggers for each feature
 *   - subjectNotificationTrigger.ts
 *   - (future) messagingNotificationTrigger.ts
 *   - (future) recordNotificationTrigger.ts
 */
// Export shared utilities (for use in other parts of your codebase)
var notificationUtils_1 = require("./notificationUtils");
// Functions
Object.defineProperty(exports, "createNotification", { enumerable: true, get: function () { return notificationUtils_1.createNotification; } });
Object.defineProperty(exports, "createNotificationForMultiple", { enumerable: true, get: function () { return notificationUtils_1.createNotificationForMultiple; } });
Object.defineProperty(exports, "getUserDisplayName", { enumerable: true, get: function () { return notificationUtils_1.getUserDisplayName; } });
Object.defineProperty(exports, "getRecordDisplayName", { enumerable: true, get: function () { return notificationUtils_1.getRecordDisplayName; } });
Object.defineProperty(exports, "markNotificationAsRead", { enumerable: true, get: function () { return notificationUtils_1.markNotificationAsRead; } });
Object.defineProperty(exports, "markAllNotificationsAsRead", { enumerable: true, get: function () { return notificationUtils_1.markAllNotificationsAsRead; } });
Object.defineProperty(exports, "deleteOldNotifications", { enumerable: true, get: function () { return notificationUtils_1.deleteOldNotifications; } });
// Export triggers (for Firebase Functions deployment)
var subjectNotificationTrigger_1 = require("./triggers/subjectNotificationTrigger");
Object.defineProperty(exports, "onRecordSubjectChange", { enumerable: true, get: function () { return subjectNotificationTrigger_1.onRecordSubjectChange; } });
//# sourceMappingURL=index.js.map