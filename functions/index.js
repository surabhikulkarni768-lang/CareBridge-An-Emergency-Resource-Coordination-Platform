const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');

initializeApp();

const db = getFirestore();
const IMPORTANT_EVENTS = new Set([
  'request_assigned',
  'request_accepted',
  'request_rejected',
  'emergency_status_updated'
]);
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token'
]);
const STALE_DELIVERY_AFTER_MS = 10 * 60 * 1000;

const isAttendantRole = (role) =>
  ['patientAttendant', 'patient_attendant', 'attendant'].includes(role);

const stableId = (value) => /^[A-Za-z0-9_]+$/.test(value);

async function activeAttendantLinkExists(attendantUid, patientUid) {
  const [nestedLink, legacyLink, attendant] = await Promise.all([
    db.doc(`users/${patientUid}/attendants/${attendantUid}`).get(),
    db.doc(`patientLinks/${attendantUid}_${patientUid}`).get(),
    db.doc(`users/${attendantUid}`).get()
  ]);
  if (!attendant.exists || !isAttendantRole(attendant.get('role')) || attendant.get('isActive') !== true) {
    return false;
  }
  return (
    (nestedLink.exists &&
      nestedLink.get('patientUid') === patientUid &&
      nestedLink.get('attendantUid') === attendantUid &&
      nestedLink.get('activeConsent') === true) ||
    (legacyLink.exists &&
      legacyLink.get('patientUid') === patientUid &&
      legacyLink.get('attendantUid') === attendantUid &&
      legacyLink.get('consentGranted') === true &&
      legacyLink.get('consentStatus') === 'granted')
  );
}

async function validateNotification(notificationId, notification) {
  if (!IMPORTANT_EVENTS.has(notification.type) ||
    typeof notification.recipientUid !== 'string' ||
    typeof notification.eventId !== 'string' ||
    typeof notification.emergencyId !== 'string') {
    return null;
  }

  const uid = notification.recipientUid;
  const eventId = notification.eventId;
  if (!stableId(eventId) || notificationId !== `${eventId}_${uid}`) return null;

  if (notification.type === 'request_assigned') {
    const requestId = notification.relatedRequestId;
    if (typeof requestId !== 'string') return null;
    const [request, audit] = await Promise.all([
      db.doc(`requests/${requestId}`).get(),
      db.doc(`requests/${requestId}/assignmentHistory/${eventId}`).get()
    ]);
    if (!request.exists || !audit.exists ||
      request.get('providerUid') !== uid ||
      request.get('caseId') !== notification.emergencyId ||
      notification.eventType !== 'request_assignment' ||
      notification.relatedCaseId !== notification.emergencyId ||
      notification.relatedRequestId !== requestId ||
      notification.resourceType !== request.get('resourceType') ||
      audit.get('newProviderUid') !== uid ||
      audit.get('coordinatorUid') !== notification.actorUid ||
      audit.get('requestId') !== requestId) return null;
    return { preference: 'requestAssignments' };
  }

  if (notification.type === 'request_accepted' || notification.type === 'request_rejected') {
    const requestId = notification.relatedRequestId;
    if (typeof requestId !== 'string') return null;
    const [request, coordinator] = await Promise.all([
      db.doc(`requests/${requestId}`).get(),
      db.doc(`users/${uid}`).get()
    ]);
    const history = request.get('statusHistory') || {};
    const event = history[eventId];
    const expectedStatus = notification.type === 'request_accepted' ? 'ACCEPTED' : 'REJECTED';
    if (!request.exists || !coordinator.exists ||
      coordinator.get('role') !== 'admin' || coordinator.get('isActive') !== true ||
      request.get('caseId') !== notification.emergencyId ||
      notification.eventType !== 'provider_response' ||
      notification.relatedCaseId !== notification.emergencyId ||
      notification.relatedRequestId !== requestId ||
      request.get('assignmentCoordinatorUid') !== uid ||
      !event || event.newStatus !== expectedStatus ||
      event.updatedByUid !== notification.actorUid ||
      event.resourceType !== notification.resourceType ||
      event.eventId !== eventId ||
      notification.details !== event.reason && notification.type === 'request_rejected') return null;
    return { preference: 'providerResponses' };
  }

  const caseId = notification.relatedCaseId;
  if (typeof caseId !== 'string') return null;
  const emergencyCase = await db.doc(`cases/${caseId}`).get();
  if (!emergencyCase.exists || emergencyCase.get('caseId') !== notification.emergencyId) return null;
  const history = emergencyCase.get('lifecycleHistory') || {};
  const event = history[eventId];
  if (!event || event.eventType !== 'case_status' ||
    event.updatedByUid !== notification.actorUid ||
    event.newStatus !== notification.newStatus ||
    event.previousStatus !== notification.previousStatus ||
    notification.eventType !== 'case_status' ||
    notification.emergencyId !== caseId) return null;

  const patientUid = emergencyCase.get('patientUid');
  if (uid === patientUid) {
    const patient = await db.doc(`users/${patientUid}`).get();
    if (!patient.exists || patient.get('role') !== 'patient' || patient.get('isActive') !== true) return null;
  } else if (!(await activeAttendantLinkExists(uid, patientUid))) {
    return null;
  }
  return { preference: 'emergencyStatus' };
}

async function claimDelivery(deliveryRef) {
  return db.runTransaction(async (transaction) => {
    const current = await transaction.get(deliveryRef);
    if (current.exists) {
      if (current.get('status') === 'sent' || current.get('status') === 'invalid') return false;
      const claimedAt = current.get('claimedAt');
      if (current.get('status') === 'sending' && claimedAt instanceof Timestamp &&
        Date.now() - claimedAt.toMillis() < STALE_DELIVERY_AFTER_MS) {
        throw new Error('Push delivery for this device is already in progress.');
      }
    }
    transaction.set(deliveryRef, {
      status: 'sending',
      claimedAt: FieldValue.serverTimestamp(),
      attempts: FieldValue.increment(1)
    });
    return true;
  });
}

async function deliverToDevice(notificationRef, notificationId, notification, tokenDoc) {
  const tokenData = tokenDoc.data();
  if (tokenData.uid !== notification.recipientUid || typeof tokenData.token !== 'string' || !tokenData.token) return;
  const deliveryRef = notificationRef.collection('pushDeliveries').doc(tokenDoc.id);
  if (!(await claimDelivery(deliveryRef))) return;

  try {
    await getMessaging().send({
      token: tokenData.token,
      data: {
        notificationId,
        eventId: notification.eventId,
        eventType: notification.eventType || notification.type,
        emergencyId: notification.emergencyId,
        title: String(notification.title || 'CareBridge emergency update'),
        body: pushMessage(notification),
        url: '/'
      },
      webpush: {
        headers: { TTL: '86400' }
      }
    });
    await deliveryRef.set({
      status: 'sent',
      sentAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    if (error && INVALID_TOKEN_CODES.has(error.code)) {
      await Promise.all([
        tokenDoc.ref.delete(),
        deliveryRef.set({ status: 'invalid', invalidAt: FieldValue.serverTimestamp() }, { merge: true })
      ]);
      return;
    }
    await deliveryRef.delete();
    throw error;
  }
}

exports.sendEmergencyPushNotification = onDocumentCreated({
  document: 'notifications/{notificationId}',
  retry: true
}, async (event) => {
  const notification = event.data && event.data.data();
  if (!notification || !IMPORTANT_EVENTS.has(notification.type)) return;

  const notificationId = event.params.notificationId;
  const notificationRef = event.data.ref;
  const authorization = await validateNotification(notificationId, notification);
  if (!authorization) {
    console.warn('Skipping unauthorized or stale emergency push notification', { notificationId });
    return;
  }

  const [preferences, tokenSnapshot] = await Promise.all([
    db.doc(`users/${notification.recipientUid}/notificationPreferences/settings`).get(),
    db.collection(`users/${notification.recipientUid}/fcmTokens`).get()
  ]);
  if (!preferences.exists ||
    preferences.get('pushEnabled') !== true ||
    preferences.get(authorization.preference) === false) return;

  const failures = [];
  for (const tokenDoc of tokenSnapshot.docs) {
    try {
      await deliverToDevice(notificationRef, notificationId, notification, tokenDoc);
    } catch (error) {
      failures.push(error);
      console.error('FCM delivery failed; Cloud Function retry will retry this event', {
        notificationId,
        tokenId: tokenDoc.id,
        error: error && error.message
      });
    }
  }
  if (failures.length) throw failures[0];
});

function pushMessage(notification) {
  if (notification.type === 'emergency_status_updated') {
    return `Emergency ${notification.emergencyId} status updated to ${notification.newStatus}.`;
  }
  if (notification.type === 'request_assigned') {
    return `Emergency ${notification.emergencyId}: a ${notification.resourceType} request was assigned to you.`;
  }
  return `Emergency ${notification.emergencyId}: ${notification.resourceType} request ${notification.type === 'request_accepted' ? 'accepted' : 'rejected'} by provider.`;
}

exports.createEmergencyStatusNotifications = onDocumentUpdated({
  document: 'cases/{caseId}',
  retry: true
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!before || !after || before.status === after.status) return;

  const caseId = event.params.caseId;
  const eventId = after.lastLifecycleEventId;
  const lifecycleHistory = after.lifecycleHistory || {};
  const lifecycleEvent = lifecycleHistory[eventId];
  if (!stableId(eventId) || !lifecycleEvent ||
    lifecycleEvent.eventType !== 'case_status' ||
    lifecycleEvent.previousStatus !== before.status ||
    lifecycleEvent.newStatus !== after.status ||
    typeof lifecycleEvent.updatedByUid !== 'string' ||
    lifecycleEvent.userRole !== 'admin') {
    console.warn('Skipping case update without a valid coordinator lifecycle event', {
      caseId,
      eventId,
      beforeStatus: before.status,
      afterStatus: after.status
    });
    return;
  }

  const patientUid = after.patientUid;
  if (typeof patientUid !== 'string' || !patientUid) return;
  const [patient, coordinator, nestedLinks, legacyLinks] = await Promise.all([
    db.doc(`users/${patientUid}`).get(),
    db.doc(`users/${lifecycleEvent.updatedByUid}`).get(),
    db.collection(`users/${patientUid}/attendants`).where('activeConsent', '==', true).get(),
    db.collection('patientLinks').where('patientUid', '==', patientUid).get()
  ]);
  if (!patient.exists || patient.get('role') !== 'patient' || patient.get('isActive') !== true ||
    !coordinator.exists || coordinator.get('role') !== 'admin' || coordinator.get('isActive') !== true) return;

  const recipientUids = new Set([patientUid]);
  const candidateUids = new Set();
  nestedLinks.docs.forEach((link) => candidateUids.add(link.get('attendantUid') || link.id));
  legacyLinks.docs.forEach((link) => {
    if (link.get('consentGranted') === true && link.get('consentStatus') === 'granted') {
      candidateUids.add(link.get('attendantUid'));
    }
  });
  for (const attendantUid of candidateUids) {
    if (typeof attendantUid === 'string' &&
      await activeAttendantLinkExists(attendantUid, patientUid)) {
      recipientUids.add(attendantUid);
    }
  }

  const notificationRefs = [...recipientUids].map((recipientUid) =>
    db.doc(`notifications/${eventId}_${recipientUid}`));
  await db.runTransaction(async (transaction) => {
    const currentNotifications = await Promise.all(
      notificationRefs.map((notificationRef) => transaction.get(notificationRef))
    );
    currentNotifications.forEach((notificationSnapshot, index) => {
      if (notificationSnapshot.exists) return;
      const recipientUid = [...recipientUids][index];
      const reason = typeof lifecycleEvent.reason === 'string' ? lifecycleEvent.reason : '';
      transaction.create(notificationRefs[index], {
        recipientUid,
        type: 'emergency_status_updated',
        eventType: 'case_status',
        eventId,
        title: `Emergency status: ${String(after.status).replaceAll('_', ' ')}`,
        message: `Emergency ${caseId} changed from ${before.status} to ${after.status}${reason ? `: ${reason}` : '.'}`,
        details: reason || `Status changed from ${before.status} to ${after.status}.`,
        previousStatus: before.status,
        newStatus: after.status,
        emergencyId: caseId,
        relatedCaseId: caseId,
        actorUid: lifecycleEvent.updatedByUid,
        isRead: false,
        createdAt: FieldValue.serverTimestamp()
      });
    });
  });
});

exports._private = { activeAttendantLinkExists, claimDelivery, validateNotification };
