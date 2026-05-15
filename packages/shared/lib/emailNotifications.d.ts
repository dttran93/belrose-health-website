export declare const NOTIFICATION_CATEGORIES: {
    recordEditing: {
        label: string;
        description: string;
    };
    recordDeletion: {
        label: string;
        description: string;
    };
    subjectRequests: {
        label: string;
        description: string;
    };
    permissions: {
        label: string;
        description: string;
    };
    credibility: {
        label: string;
        description: string;
    };
    trustee: {
        label: string;
        description: string;
    };
    recordRequests: {
        label: string;
        description: string;
    };
};
export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;
export interface ChannelPrefs {
    inApp: boolean;
    email: boolean;
}
export type NotificationPrefs = Record<NotificationCategory, ChannelPrefs>;
export declare const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs;
//# sourceMappingURL=emailNotifications.d.ts.map