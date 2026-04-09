import { adminDb } from "@/lib/firebase/admin";
import type { Notification } from "@/types";

const COLLECTION = "notifications";

export class NotificationService {
  static async create(
    companyId: string,
    userId: string,
    data: Pick<Notification, "title" | "message" | "type" | "actionUrl">
  ): Promise<Notification> {
    const docRef = adminDb.collection(COLLECTION).doc();
    const notification: Notification = {
      id: docRef.id,
      companyId,
      userId,
      ...data,
      read: false,
      createdAt: new Date().toISOString(),
    };
    await docRef.set(notification);
    return notification;
  }

  static async getForUser(
    companyId: string,
    userId: string,
    limit = 20
  ): Promise<Notification[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((d) => d.data() as Notification);
  }

  static async markRead(notificationId: string, userId: string): Promise<void> {
    const docRef = adminDb.collection(COLLECTION).doc(notificationId);
    const doc = await docRef.get();
    if (!doc.exists) return;
    const notification = doc.data() as Notification;
    if (notification.userId !== userId) return;
    await docRef.update({ read: true });
  }

  static async markAllRead(companyId: string, userId: string): Promise<void> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("userId", "==", userId)
      .where("read", "==", false)
      .get();

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
  }

  static async getUnreadCount(companyId: string, userId: string): Promise<number> {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("userId", "==", userId)
      .where("read", "==", false)
      .count()
      .get();
    return snap.data().count;
  }

  // ─── Bulk Notify ──────────────────────────────────────────
  static async notifyCompanyAdmins(
    companyId: string,
    data: Pick<Notification, "title" | "message" | "type" | "actionUrl">
  ): Promise<void> {
    const admins = await adminDb
      .collection("users")
      .where("companyId", "==", companyId)
      .where("role", "in", ["COMPANY_ADMIN", "SUPER_ADMIN"])
      .get();

    const batch = adminDb.batch();
    admins.docs.forEach((adminDoc) => {
      const docRef = adminDb.collection(COLLECTION).doc();
      batch.set(docRef, {
        id: docRef.id,
        companyId,
        userId: adminDoc.id,
        ...data,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
    await batch.commit();
  }
}
