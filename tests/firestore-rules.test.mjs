import assert from 'node:assert/strict';

const projectId = process.env.GCLOUD_PROJECT || 'demo-carebridge';
const firestoreBase = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const authBase = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const documentsUrl = `http://${firestoreBase}/v1/projects/${projectId}/databases/(default)/documents`;
const authUrl = `http://${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-test-key`;
const passed = [];

const fieldValue = (value) => {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fieldValue) } };
  return {
    mapValue: {
      fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fieldValue(item)]))
    }
  };
};

const valueAt = (value) => {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, valueAt(item)]));
  if (value.arrayValue) return (value.arrayValue.values || []).map(valueAt);
  return null;
};

const encodedFields = (data) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, fieldValue(value)]));

const request = async (url, { method = 'GET', token, body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
};

const expectSuccess = (response, label) => {
  assert.ok(response.status >= 200 && response.status < 300, `${label} returned HTTP ${response.status}: ${JSON.stringify(response.data)}`);
};

const seed = async (path, data) => {
  const response = await request(`${documentsUrl}/${path}`, {
    method: 'PATCH',
    token: 'owner',
    body: { fields: encodedFields(data) }
  });
  expectSuccess(response, `Seed ${path}`);
};

const read = async (path, token) => request(`${documentsUrl}/${path}`, { token });
const createDocument = async (path, data, token) => request(`${documentsUrl}/${path}`, {
  method: 'PATCH',
  token,
  body: { fields: encodedFields(data) }
});

const runQuery = async (query, token) => request(`${documentsUrl}:runQuery`, {
  method: 'POST',
  token,
  body: { structuredQuery: query }
});

const check = async (name, test) => {
  await test();
  passed.push(name);
  console.log(`PASS ${name}`);
};

const createAccount = async (name, role) => {
  const email = `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}@rules.test`;
  const result = await request(authUrl, {
    method: 'POST',
    body: { email, password: 'Test-password-123!', returnSecureToken: true }
  });
  expectSuccess(result, `Create Auth emulator user ${name}`);
  const uid = result.data.localId;
  await seed(`users/${uid}`, { uid, email, role, isActive: true, isVerified: true });
  return { uid, token: result.data.idToken, role };
};

const stringFilter = (fieldPath, value) => ({
  fieldFilter: {
    field: { fieldPath },
    op: 'EQUAL',
    value: { stringValue: value }
  }
});

const booleanFilter = (fieldPath, value) => ({
  fieldFilter: {
    field: { fieldPath },
    op: 'EQUAL',
    value: { booleanValue: value }
  }
});

const caseId = `CB-RULE-TEST-${Date.now()}`;
const patientCase = {
  caseId,
  patientUid: '',
  patientName: 'Rules Test Patient',
  patientAge: 41,
  patientGender: 'Not specified',
  conditionSummary: 'Rules test case',
  urgencyLevel: 'emergency',
  resourcesNeeded: ['blood'],
  location: { city: 'Hubballi', address: 'Rules test address' },
  attendant: { name: 'Rules Test Attendant', relation: 'Self', phone: '+911234567890' },
  status: 'REQUESTED',
  requestCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const patient = await createAccount('patient', 'patient');
const attendant = await createAccount('attendant', 'patientAttendant');
const revokedAttendant = await createAccount('revoked-attendant', 'patientAttendant');
const stranger = await createAccount('stranger', 'patient');
const assignedProvider = await createAccount('assigned-provider', 'bloodBank');
const unassignedProvider = await createAccount('unassigned-provider', 'bloodBank');
const reassignedProvider = await createAccount('reassigned-provider', 'bloodBank');
const inactiveProvider = await createAccount('inactive-provider', 'bloodBank');
const unverifiedProvider = await createAccount('unverified-provider', 'bloodBank');
const hospitalProvider = await createAccount('hospital-provider', 'hospital');
const oxygenProvider = await createAccount('oxygen-provider', 'oxygenProvider');
const ambulanceProvider = await createAccount('ambulance-provider', 'ambulanceProvider');
const doctorProvider = await createAccount('doctor-provider', 'doctor');
const admin = await createAccount('admin', 'admin');
const suspendedPatient = await createAccount('suspended-patient', 'patient');
await seed(`users/${suspendedPatient.uid}`, {
  uid: suspendedPatient.uid,
  email: 'suspended-patient@rules.test',
  role: 'patient',
  isActive: false,
  isVerified: true
});
await seed(`providerDirectory/${assignedProvider.uid}`, {
  uid: assignedProvider.uid,
  role: 'bloodBank',
  displayName: 'Rules Test Blood Bank',
  city: 'Hubballi',
  isActive: true,
  isVerified: true
});
await seed(`providerDirectory/${unassignedProvider.uid}`, {
  uid: unassignedProvider.uid,
  role: 'bloodBank',
  displayName: 'Unassigned Blood Bank',
  city: 'Hubballi',
  isActive: true,
  isVerified: true
});
await seed(`providerDirectory/${reassignedProvider.uid}`, {
  uid: reassignedProvider.uid,
  role: 'bloodBank',
  displayName: 'Reassigned Blood Bank',
  city: 'Hubballi',
  isActive: true,
  isVerified: true
});
await seed(`users/${inactiveProvider.uid}`, {
  uid: inactiveProvider.uid,
  email: 'inactive-provider@rules.test',
  role: 'bloodBank',
  isActive: false,
  isVerified: true
});
await seed(`providerDirectory/${inactiveProvider.uid}`, {
  uid: inactiveProvider.uid,
  role: 'bloodBank',
  displayName: 'Inactive Blood Bank',
  city: 'Hubballi',
  isActive: false,
  isVerified: true
});
await seed(`users/${unverifiedProvider.uid}`, {
  uid: unverifiedProvider.uid,
  email: 'unverified-provider@rules.test',
  role: 'bloodBank',
  isActive: true,
  isVerified: false
});
await seed(`providerDirectory/${unverifiedProvider.uid}`, {
  uid: unverifiedProvider.uid,
  role: 'bloodBank',
  displayName: 'Unverified Blood Bank',
  city: 'Hubballi',
  isActive: true,
  isVerified: false
});
for (const provider of [
  { account: hospitalProvider, role: 'hospital' },
  { account: oxygenProvider, role: 'oxygenProvider' },
  { account: ambulanceProvider, role: 'ambulanceProvider' },
  { account: doctorProvider, role: 'doctor' }
]) {
  await seed(`providerDirectory/${provider.account.uid}`, {
    uid: provider.account.uid,
    role: provider.role,
    displayName: `${provider.role} provider`,
    isActive: true,
    isVerified: true
  });
}
const caseDocument = { ...patientCase, patientUid: patient.uid, requesterUid: patient.uid };
caseDocument.assignedBloodBankUid = assignedProvider.uid;
const requestDocument = {
  requestId: `REQ-${caseId}-blood`,
  caseId,
  patientUid: patient.uid,
  requesterUid: patient.uid,
  providerUid: assignedProvider.uid,
  providerName: 'Rules Test Blood Bank',
  resourceType: 'blood',
  details: { bloodGroup: 'O+', units: 1 },
  status: 'REQUESTED',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
const batchCommit = async (token, writes) => request(`${documentsUrl}:commit`, {
  method: 'POST',
  token,
  body: { writes }
});
const updateWrite = (path, data) => ({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/${path}`,
    fields: encodedFields(data)
  }
});
const caseStatusWrite = ({ targetCaseId, previousStatus, newStatus, reason, eventId, actor, role = actor.role }) => {
  const fields = {
    status: newStatus,
    lastLifecycleEventId: eventId,
    lifecycleHistory: {
      [eventId]: {
        eventId,
        eventType: 'case_status',
        previousStatus,
        newStatus,
        updatedByUid: actor.uid,
        userRole: role,
        timestamp: '2026-01-01T00:00:00.000Z',
        ...(reason ? { reason } : {})
      }
    },
    ...(newStatus === 'REJECTED' && reason ? { rejectionReason: reason } : {}),
    ...(newStatus === 'CANCELLED' && reason ? { cancellationReason: reason } : {})
  };
  return {
    update: {
      name: `projects/${projectId}/databases/(default)/documents/cases/${targetCaseId}`,
      fields: encodedFields(fields)
    },
    updateMask: {
      fieldPaths: [
        'status',
        'lastLifecycleEventId',
        `lifecycleHistory.${eventId}`,
        ...(newStatus === 'REJECTED' ? ['rejectionReason'] : []),
        ...(newStatus === 'CANCELLED' ? ['cancellationReason'] : [])
      ]
    },
    updateTransforms: [
      { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
      { fieldPath: `lifecycleHistory.${eventId}.timestamp`, setToServerValue: 'REQUEST_TIME' }
    ]
  };
};
const responseEventId = (requestId) => `provider_response_${requestId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
const responseNotificationId = (requestId) => `${responseEventId(requestId)}_${admin.uid}`;
const waitForDocument = async (path, token, attempts = 100) => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = await read(path, token);
    if (result.status === 200) return result;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return read(path, token);
};
const assignmentWrites = ({ provider, reason, auditId }) => {
  const requestPath = `projects/${projectId}/databases/(default)/documents/requests/${requestDocument.requestId}`;
  const auditPath = `${requestPath}/assignmentHistory/${auditId}`;
  const notificationPath = `projects/${projectId}/databases/(default)/documents/notifications/${auditId}_${provider.uid}`;
  const statusEventId = 'assignment_status_event';
  return [
    {
      update: {
        name: requestPath,
        fields: encodedFields({
          providerUid: provider.uid,
          providerName: provider.name,
          assignmentCoordinatorUid: admin.uid,
          lastAssignmentAuditId: auditId,
          status: 'ASSIGNED',
          lastStatusEventId: statusEventId,
          statusHistory: {
            [statusEventId]: {
              eventId: statusEventId,
              eventType: 'request_status',
              previousStatus: 'REQUESTED',
              newStatus: 'ASSIGNED',
              updatedByUid: admin.uid,
              userRole: 'admin',
              timestamp: '2026-01-01T00:00:00.000Z',
              requestId: requestDocument.requestId,
              resourceType: 'blood'
            }
          }
        })
      },
      updateMask: {
        fieldPaths: [
          'providerUid',
          'providerName',
          'assignmentCoordinatorUid',
          'lastAssignmentAuditId',
          'status',
          'lastStatusEventId',
          `statusHistory.${statusEventId}`
        ]
      },
      updateTransforms: [
        { fieldPath: 'assignedAt', setToServerValue: 'REQUEST_TIME' },
        { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        { fieldPath: `statusHistory.${statusEventId}.timestamp`, setToServerValue: 'REQUEST_TIME' }
      ]
    },
    {
      update: {
        name: auditPath,
        fields: encodedFields({
          requestId: requestDocument.requestId,
          caseId,
          resourceType: 'blood',
          previousProviderUid: assignedProvider.uid,
          previousProviderName: 'Rules Test Blood Bank',
          newProviderUid: provider.uid,
          newProviderName: provider.name,
          coordinatorUid: admin.uid,
          coordinatorName: 'Rules Test Admin',
          reason
        })
      },
      updateTransforms: [{ fieldPath: 'timestamp', setToServerValue: 'REQUEST_TIME' }]
    },
    {
      update: {
        name: notificationPath,
        fields: encodedFields({
          recipientUid: provider.uid,
          type: 'request_assigned',
          eventType: 'request_assignment',
          eventId: auditId,
          title: 'Resource request reassigned',
          message: `Emergency ${caseId}: blood request assigned to you after reassignment: ${reason}`,
          details: reason,
          emergencyId: caseId,
          relatedCaseId: caseId,
          relatedRequestId: requestDocument.requestId,
          resourceType: 'blood',
          actorUid: admin.uid,
          isRead: false
        })
      },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }]
    }
  ];
};
const responseWrites = ({
  provider,
  status,
  reason,
  notificationId,
  requestId = requestDocument.requestId,
  responseCaseId = caseId,
  providerUid = provider.uid,
  resourceType = requestDocument.resourceType,
  previousStatus = 'ASSIGNED'
}) => {
  const requestPath = `projects/${projectId}/databases/(default)/documents/requests/${requestId}`;
  const responseStatus = status === 'accepted' ? 'ACCEPTED' : 'REJECTED';
  const statusEventId = responseEventId(requestId);
  const responseDetails = status === 'accepted' ? 'Accepted by provider.' : reason;
  const notificationPath = `projects/${projectId}/databases/(default)/documents/notifications/${statusEventId}_${admin.uid}`;
  return [
    {
      update: {
        name: requestPath,
        fields: encodedFields({
          status: responseStatus,
          respondedByUid: providerUid,
          responseDetails,
          ...(status === 'rejected' ? { rejectionReason: reason } : {}),
          lastStatusEventId: statusEventId,
          statusHistory: {
            [statusEventId]: {
              eventId: statusEventId,
              eventType: 'request_status',
              previousStatus,
              newStatus: responseStatus,
              updatedByUid: providerUid,
              userRole: provider.role || 'bloodBank',
              timestamp: '2026-01-01T00:00:00.000Z',
              ...(status === 'rejected' ? { reason } : {}),
              requestId,
              resourceType
            }
          }
        })
      },
      updateMask: {
        fieldPaths: [
          'status',
          'respondedByUid',
          'responseDetails',
          ...(status === 'rejected' ? ['rejectionReason'] : []),
          'lastStatusEventId',
          `statusHistory.${statusEventId}`
        ]
      },
      updateTransforms: [
        { fieldPath: 'respondedAt', setToServerValue: 'REQUEST_TIME' },
        { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        { fieldPath: `statusHistory.${statusEventId}.timestamp`, setToServerValue: 'REQUEST_TIME' }
      ]
    },
    {
      update: {
        name: notificationPath,
        fields: encodedFields({
          recipientUid: admin.uid,
          type: status === 'accepted' ? 'request_accepted' : 'request_rejected',
          eventType: 'provider_response',
          eventId: statusEventId,
          title: `Resource request ${status}`,
          message: `Provider ${providerUid} responded to request ${requestId}.`,
          details: responseDetails,
          emergencyId: responseCaseId,
          relatedCaseId: responseCaseId,
          relatedRequestId: requestId,
          resourceType,
          actorUid: providerUid,
          responseProviderUid: providerUid,
          isRead: false
        })
      },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }]
    }
  ];
};

try {
  await check('Patient auth profile is present for authorization checks', async () => {
    const result = await read(`users/${patient.uid}`, patient.token);
    expectSuccess(result, 'Patient own user profile');
    assert.equal(result.data.fields.role.stringValue, 'patient');
  });

  await check('Patient preflight get of a missing case is permitted without a null rules error', async () => {
    const result = await read(`cases/${caseId}`, patient.token);
    assert.equal(result.status, 404, JSON.stringify(result.data));
  });

  await check('Patient can create a case document with valid ownership and consent fields', async () => {
    const simpleCaseId = `${caseId}-CASE`;
    const result = await createDocument(`cases/${simpleCaseId}`, {
      ...caseDocument,
      caseId: simpleCaseId
    }, patient.token);
    expectSuccess(result, 'Patient case creation');
  });

  await check('Patient atomically creates a case and linked resource request', async () => {
    const result = await batchCommit(patient.token, [
      updateWrite(`cases/${caseId}`, caseDocument),
      updateWrite(`requests/${requestDocument.requestId}`, requestDocument)
    ]);
    expectSuccess(result, 'Patient case/request batch');

    const savedCase = await read(`cases/${caseId}`, patient.token);
    const savedRequest = await read(`requests/${requestDocument.requestId}`, patient.token);
    expectSuccess(savedCase, 'Patient case readback');
    expectSuccess(savedRequest, 'Patient request readback');
    assert.equal(savedCase.data.fields.patientUid.stringValue, patient.uid);
    assert.equal(savedRequest.data.fields.caseId.stringValue, caseId);
    assert.equal(savedRequest.data.fields.requesterUid.stringValue, patient.uid);
  });

  await check('Coordinator case transitions are authorized, ordered, reasoned, and recorded atomically', async () => {
    const lifecycleCaseId = `${caseId}-LIFECYCLE`;
    await seed(`cases/${lifecycleCaseId}`, {
      ...caseDocument,
      caseId: lifecycleCaseId,
      status: 'REQUESTED'
    });

    const patientAttempt = await batchCommit(patient.token, [caseStatusWrite({
      targetCaseId: lifecycleCaseId,
      previousStatus: 'REQUESTED',
      newStatus: 'UNDER_REVIEW',
      eventId: 'patient_attempt',
      actor: patient
    })]);
    const providerAttempt = await batchCommit(assignedProvider.token, [caseStatusWrite({
      targetCaseId: lifecycleCaseId,
      previousStatus: 'REQUESTED',
      newStatus: 'UNDER_REVIEW',
      eventId: 'provider_attempt',
      actor: assignedProvider
    })]);
    const invalidTransition = await batchCommit(admin.token, [caseStatusWrite({
      targetCaseId: lifecycleCaseId,
      previousStatus: 'REQUESTED',
      newStatus: 'COMPLETED',
      eventId: 'invalid_attempt',
      actor: admin
    })]);
    const missingReason = await batchCommit(admin.token, [caseStatusWrite({
      targetCaseId: lifecycleCaseId,
      previousStatus: 'REQUESTED',
      newStatus: 'REJECTED',
      eventId: 'missing_reason',
      actor: admin
    })]);
    assert.equal(patientAttempt.status, 403, JSON.stringify(patientAttempt.data));
    assert.equal(providerAttempt.status, 403, JSON.stringify(providerAttempt.data));
    assert.equal(invalidTransition.status, 403, JSON.stringify(invalidTransition.data));
    assert.equal(missingReason.status, 403, JSON.stringify(missingReason.data));

    const underReview = await batchCommit(admin.token, [caseStatusWrite({
      targetCaseId: lifecycleCaseId,
      previousStatus: 'REQUESTED',
      newStatus: 'UNDER_REVIEW',
      eventId: 'under_review',
      actor: admin
    })]);
    expectSuccess(underReview, 'Coordinator marks emergency under review');
    const rejection = await batchCommit(admin.token, [caseStatusWrite({
      targetCaseId: lifecycleCaseId,
      previousStatus: 'UNDER_REVIEW',
      newStatus: 'REJECTED',
      reason: 'No eligible resources can fulfill this case.',
      eventId: 'rejected',
      actor: admin
    })]);
    expectSuccess(rejection, 'Coordinator rejects emergency with reason');

    const terminalConflict = await batchCommit(admin.token, [caseStatusWrite({
      targetCaseId: lifecycleCaseId,
      previousStatus: 'REJECTED',
      newStatus: 'CANCELLED',
      reason: 'Conflicting terminal transition',
      eventId: 'terminal_conflict',
      actor: admin
    })]);
    assert.equal(terminalConflict.status, 403, JSON.stringify(terminalConflict.data));

    const savedCase = await read(`cases/${lifecycleCaseId}`, admin.token);
    expectSuccess(savedCase, 'Lifecycle case readback');
    assert.equal(savedCase.data.fields.status.stringValue, 'REJECTED');
    assert.equal(savedCase.data.fields.rejectionReason.stringValue, 'No eligible resources can fulfill this case.');
    const history = savedCase.data.fields.lifecycleHistory.mapValue.fields;
    assert.equal(Object.keys(history).length, 2);
    assert.equal(history.under_review.mapValue.fields.previousStatus.stringValue, 'REQUESTED');
    assert.equal(history.rejected.mapValue.fields.newStatus.stringValue, 'REJECTED');
    assert.equal(history.rejected.mapValue.fields.updatedByUid.stringValue, admin.uid);
    assert.equal(history.rejected.mapValue.fields.userRole.stringValue, 'admin');
    assert.ok(history.rejected.mapValue.fields.timestamp.timestampValue);
  });

  await check('Emergency status notifications are generated by trusted functions for patient and active attendants', async () => {
    const notificationCaseId = `${caseId}-NOTIFICATION`;
    const notificationCase = {
      ...caseDocument,
      caseId: notificationCaseId,
      status: 'REQUESTED'
    };
    await seed(`cases/${notificationCaseId}`, notificationCase);
    await seed(`users/${patient.uid}/attendants/${attendant.uid}`, {
      patientUid: patient.uid,
      attendantUid: attendant.uid,
      activeConsent: true,
      updatedAt: new Date().toISOString()
    });
    await seed(`users/${patient.uid}/attendants/${revokedAttendant.uid}`, {
      patientUid: patient.uid,
      attendantUid: revokedAttendant.uid,
      activeConsent: false,
      updatedAt: new Date().toISOString()
    });

    const activeEventId = 'active_consent_status_event';
    const validStatusUpdate = await batchCommit(admin.token, [
      caseStatusWrite({
        targetCaseId: notificationCaseId,
        previousStatus: 'REQUESTED',
        newStatus: 'UNDER_REVIEW',
        eventId: activeEventId,
        actor: admin
      })
    ]);
    expectSuccess(validStatusUpdate, 'Coordinator status transition');

    const patientNotice = await waitForDocument(`notifications/${activeEventId}_${patient.uid}`, patient.token);
    const attendantNotice = await waitForDocument(`notifications/${activeEventId}_${attendant.uid}`, attendant.token);
    const patientNoticeAsCoordinator = await read(`notifications/${activeEventId}_${patient.uid}`, admin.token);
    expectSuccess(patientNotice, 'Patient receives emergency status update');
    expectSuccess(attendantNotice, 'Active attendant receives emergency status update');
    assert.equal(patientNoticeAsCoordinator.status, 403, JSON.stringify(patientNoticeAsCoordinator.data));
    assert.equal(patientNotice.data.fields.emergencyId.stringValue, notificationCaseId);
    assert.equal(patientNotice.data.fields.eventType.stringValue, 'case_status');
    assert.ok(patientNotice.data.fields.createdAt.timestampValue);

    const revokedEventId = 'revoked_consent_status_event';
    const revokedNoticeAttempt = await batchCommit(admin.token, [
      caseStatusWrite({
        targetCaseId: notificationCaseId,
        previousStatus: 'UNDER_REVIEW',
        newStatus: 'ASSIGNED',
        eventId: revokedEventId,
        actor: admin
      })
    ]);
    expectSuccess(revokedNoticeAttempt, 'Coordinator status transition with revoked attendant consent');
    const patientNoticeAfterSecondTransition = await waitForDocument(
      `notifications/${revokedEventId}_${patient.uid}`,
      patient.token
    );
    const revokedNotice = await read(`notifications/${revokedEventId}_${revokedAttendant.uid}`, revokedAttendant.token);
    expectSuccess(patientNoticeAfterSecondTransition, 'Patient receives second emergency status update');
    assert.equal(revokedNotice.status, 404, JSON.stringify(revokedNotice.data));

    const duplicateNoticeAttempt = await createDocument(
      `notifications/${activeEventId}_${patient.uid}`,
      {
        recipientUid: patient.uid,
        type: 'emergency_status_updated',
        eventType: 'case_status',
        eventId: activeEventId,
        title: 'Duplicate status event',
        message: 'Duplicate event',
        emergencyId: notificationCaseId,
        relatedCaseId: notificationCaseId,
        actorUid: admin.uid,
        isRead: false,
        createdAt: new Date().toISOString()
      },
      admin.token
    );
    assert.equal(duplicateNoticeAttempt.status, 403, JSON.stringify(duplicateNoticeAttempt.data));
  });

  await check('Only an account owner can store device tokens and push preferences', async () => {
    const tokenPath = `projects/${projectId}/databases/(default)/documents/users/${patient.uid}/fcmTokens/device-hash-1`;
    const tokenWrite = {
      update: {
        name: tokenPath,
        fields: encodedFields({
          uid: patient.uid,
          token: 'opaque-fcm-token-test',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        })
      },
      updateTransforms: [
        { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
        { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
      ]
    };
    const preferencesPath = `projects/${projectId}/databases/(default)/documents/users/${patient.uid}/notificationPreferences/settings`;
    const preferencesWrite = {
      update: {
        name: preferencesPath,
        fields: encodedFields({
          pushEnabled: true,
          emergencyStatus: true,
          requestAssignments: false,
          providerResponses: true,
          updatedAt: '2026-01-01T00:00:00.000Z'
        })
      },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }]
    };
    const validRegistration = await batchCommit(patient.token, [tokenWrite, preferencesWrite]);
    expectSuccess(validRegistration, 'Owner registers a device and preferences');

    const ownerRead = await read(`users/${patient.uid}/fcmTokens/device-hash-1`, patient.token);
    const stolenTokenRead = await read(`users/${patient.uid}/fcmTokens/device-hash-1`, stranger.token);
    expectSuccess(ownerRead, 'Owner reads own token');
    assert.equal(stolenTokenRead.status, 403, JSON.stringify(stolenTokenRead.data));

    const unauthorizedTokenWrite = await batchCommit(stranger.token, [tokenWrite]);
    const unauthorizedPreferencesWrite = await batchCommit(stranger.token, [preferencesWrite]);
    assert.equal(unauthorizedTokenWrite.status, 403, JSON.stringify(unauthorizedTokenWrite.data));
    assert.equal(unauthorizedPreferencesWrite.status, 403, JSON.stringify(unauthorizedPreferencesWrite.data));

    const arbitraryPush = await createDocument('notifications/arbitrary-client-push', {
      recipientUid: patient.uid,
      type: 'emergency_status_updated',
      eventType: 'case_status',
      eventId: 'made_up_event',
      title: 'Forged push',
      message: 'Client-created notification',
      emergencyId: caseId,
      relatedCaseId: caseId,
      actorUid: patient.uid,
      previousStatus: 'REQUESTED',
      newStatus: 'COMPLETED',
      isRead: false,
      createdAt: new Date().toISOString()
    }, patient.token);
    assert.equal(arbitraryPush.status, 403, JSON.stringify(arbitraryPush.data));
  });

  await check('Patient and provider cannot assign resource requests', async () => {
    const patientAttempt = await batchCommit(patient.token, assignmentWrites({
      provider: { uid: reassignedProvider.uid, name: 'Reassigned Blood Bank' },
      reason: 'Unauthorized patient assignment',
      auditId: `${caseId}-patient-attempt`
    }));
    const providerAttempt = await batchCommit(assignedProvider.token, assignmentWrites({
      provider: { uid: reassignedProvider.uid, name: 'Reassigned Blood Bank' },
      reason: 'Unauthorized provider assignment',
      auditId: `${caseId}-provider-attempt`
    }));
    assert.equal(patientAttempt.status, 403, JSON.stringify(patientAttempt.data));
    assert.equal(providerAttempt.status, 403, JSON.stringify(providerAttempt.data));
  });

  await check('Only active and verified eligible providers can be assigned', async () => {
    const inactiveAttempt = await batchCommit(admin.token, assignmentWrites({
      provider: { uid: inactiveProvider.uid, name: 'Inactive Blood Bank' },
      reason: 'Replace current provider',
      auditId: `${caseId}-inactive-attempt`
    }));
    const unverifiedAttempt = await batchCommit(admin.token, assignmentWrites({
      provider: { uid: unverifiedProvider.uid, name: 'Unverified Blood Bank' },
      reason: 'Replace current provider',
      auditId: `${caseId}-unverified-attempt`
    }));
    assert.equal(inactiveAttempt.status, 403, JSON.stringify(inactiveAttempt.data));
    assert.equal(unverifiedAttempt.status, 403, JSON.stringify(unverifiedAttempt.data));
  });

  await check('Reassignment requires a reason and writes a linked immutable audit record', async () => {
    const missingReason = await batchCommit(admin.token, assignmentWrites({
      provider: { uid: reassignedProvider.uid, name: 'Reassigned Blood Bank' },
      reason: '',
      auditId: `${caseId}-missing-reason`
    }));
    assert.equal(missingReason.status, 403, JSON.stringify(missingReason.data));

    const auditId = `${caseId}-audit-1`;
    const assignmentWithoutNotice = assignmentWrites({
      provider: { uid: reassignedProvider.uid, name: 'Reassigned Blood Bank' },
      reason: 'Original provider unavailable',
      auditId: `${caseId}-no-notice`
    });
    assignmentWithoutNotice.pop();
    const assignmentWithoutNoticeResult = await batchCommit(admin.token, assignmentWithoutNotice);
    assert.equal(assignmentWithoutNoticeResult.status, 403, JSON.stringify(assignmentWithoutNoticeResult.data));

    const reassignment = await batchCommit(admin.token, assignmentWrites({
      provider: { uid: reassignedProvider.uid, name: 'Reassigned Blood Bank' },
      reason: 'Original provider unavailable',
      auditId
    }));
    expectSuccess(reassignment, 'Coordinator request reassignment');

    const updatedRequest = await read(`requests/${requestDocument.requestId}`, admin.token);
    const auditRecord = await read(`requests/${requestDocument.requestId}/assignmentHistory/${auditId}`, admin.token);
    const assignmentNotification = await read(`notifications/${auditId}_${reassignedProvider.uid}`, reassignedProvider.token);
    const formerProviderAssignmentNotice = await read(`notifications/${auditId}_${reassignedProvider.uid}`, assignedProvider.token);
    expectSuccess(updatedRequest, 'Reassigned request read');
    expectSuccess(auditRecord, 'Assignment audit read');
    expectSuccess(assignmentNotification, 'New provider assignment notification');
    assert.equal(formerProviderAssignmentNotice.status, 403, JSON.stringify(formerProviderAssignmentNotice.data));
    assert.equal(updatedRequest.data.fields.providerUid.stringValue, reassignedProvider.uid);
    assert.equal(updatedRequest.data.fields.status.stringValue, 'ASSIGNED', 'The assignment lifecycle is tracked on the individual request');
    assert.ok(updatedRequest.data.fields.statusHistory.mapValue.fields.assignment_status_event);
    assert.equal(updatedRequest.data.fields.assignmentCoordinatorUid.stringValue, admin.uid);
    assert.equal(auditRecord.data.fields.previousProviderUid.stringValue, assignedProvider.uid);
    assert.equal(auditRecord.data.fields.newProviderUid.stringValue, reassignedProvider.uid);
    assert.equal(auditRecord.data.fields.coordinatorUid.stringValue, admin.uid);
    assert.equal(auditRecord.data.fields.reason.stringValue, 'Original provider unavailable');
    assert.ok(auditRecord.data.fields.timestamp.timestampValue);
    assert.equal(assignmentNotification.data.fields.emergencyId.stringValue, caseId);
    assert.equal(assignmentNotification.data.fields.eventType.stringValue, 'request_assignment');
    assert.equal(assignmentNotification.data.fields.eventId.stringValue, auditId);
    assert.ok(assignmentNotification.data.fields.createdAt.timestampValue);
  });

  await check('Providers can read only currently assigned requests and cannot alter assignment history', async () => {
    const previousProviderRead = await read(`requests/${requestDocument.requestId}`, assignedProvider.token);
    const currentProviderRead = await read(`requests/${requestDocument.requestId}`, reassignedProvider.token);
    const formerProviderCaseRead = await read(`cases/${caseId}`, assignedProvider.token);
    const currentProviderCaseRead = await read(`cases/${caseId}`, reassignedProvider.token);
    const assignedProviderQuery = await runQuery({
      from: [{ collectionId: 'requests' }],
      where: stringFilter('providerUid', reassignedProvider.uid)
    }, reassignedProvider.token);
    const formerProviderQuery = await runQuery({
      from: [{ collectionId: 'requests' }],
      where: stringFilter('providerUid', assignedProvider.uid)
    }, reassignedProvider.token);
    assert.equal(previousProviderRead.status, 403, JSON.stringify(previousProviderRead.data));
    expectSuccess(currentProviderRead, 'Current provider request read');
    assert.equal(formerProviderCaseRead.status, 403, JSON.stringify(formerProviderCaseRead.data));
    expectSuccess(currentProviderCaseRead, 'Current provider assigned case read');
    expectSuccess(assignedProviderQuery, 'Current provider assigned request query');
    assert.ok(assignedProviderQuery.data.some((item) => item.document?.name.endsWith(`/requests/${requestDocument.requestId}`)));
    assert.equal(formerProviderQuery.status, 403, JSON.stringify(formerProviderQuery.data));

    const tamperAudit = await request(`${documentsUrl}/requests/${requestDocument.requestId}/assignmentHistory/${caseId}-audit-1`, {
      method: 'PATCH',
      token: admin.token,
      body: { fields: encodedFields({ reason: 'Altered historical reason' }) }
    });
    assert.equal(tamperAudit.status, 403, JSON.stringify(tamperAudit.data));

    const deleteAudit = await request(`${documentsUrl}/requests/${requestDocument.requestId}/assignmentHistory/${caseId}-audit-1`, {
      method: 'DELETE',
      token: admin.token
    });
    assert.equal(deleteAudit.status, 403, JSON.stringify(deleteAudit.data));
  });

  await check('Only the current provider can submit one accepted response and notify its coordinator', async () => {
    const formerProviderAttempt = await batchCommit(assignedProvider.token, responseWrites({
      provider: assignedProvider,
      status: 'accepted',
      notificationId: `${caseId}-former-provider-notification`
    }));
    const unassignedProviderAttempt = await batchCommit(unassignedProvider.token, responseWrites({
      provider: unassignedProvider,
      status: 'accepted',
      notificationId: `${caseId}-unassigned-provider-notification`
    }));
    assert.equal(formerProviderAttempt.status, 403, JSON.stringify(formerProviderAttempt.data));
    assert.equal(unassignedProviderAttempt.status, 403, JSON.stringify(unassignedProviderAttempt.data));

    const responseWithoutNotification = await batchCommit(reassignedProvider.token, [
      responseWrites({
        provider: reassignedProvider,
        status: 'accepted',
        notificationId: `${caseId}-missing-response-notification`
      })[0]
    ]);
    assert.equal(responseWithoutNotification.status, 403, JSON.stringify(responseWithoutNotification.data));

    const validResponse = await batchCommit(reassignedProvider.token, responseWrites({
      provider: reassignedProvider,
      status: 'accepted',
      notificationId: `${caseId}-response-notification`
    }));
    expectSuccess(validResponse, 'Assigned provider response with coordinator notification');

    const responseRecord = await read(`requests/${requestDocument.requestId}`, reassignedProvider.token);
    const notificationId = responseNotificationId(requestDocument.requestId);
    const notification = await read(`notifications/${notificationId}`, admin.token);
    const auditRecord = await read(`requests/${requestDocument.requestId}/assignmentHistory/${caseId}-audit-1`, admin.token);
    expectSuccess(responseRecord, 'Provider response readback');
    expectSuccess(notification, 'Coordinator notification readback');
    expectSuccess(auditRecord, 'Assignment audit remains available after response');
    assert.equal(responseRecord.data.fields.status.stringValue, 'ACCEPTED');
    assert.equal(responseRecord.data.fields.respondedByUid.stringValue, reassignedProvider.uid);
    assert.equal(responseRecord.data.fields.responseDetails.stringValue, 'Accepted by provider.');
    assert.ok(responseRecord.data.fields.respondedAt.timestampValue);
    assert.equal(notification.data.fields.recipientUid.stringValue, admin.uid);
    assert.equal(notification.data.fields.relatedRequestId.stringValue, requestDocument.requestId);
    assert.equal(auditRecord.data.fields.previousProviderUid.stringValue, assignedProvider.uid);
    const unchangedCase = await read(`cases/${caseId}`, patient.token);
    expectSuccess(unchangedCase, 'Emergency case remains readable after request response');
    assert.equal(unchangedCase.data.fields.status.stringValue, 'REQUESTED', 'Provider response must not update the emergency case');

    const unreadByStranger = await read(`notifications/${notificationId}`, stranger.token);
    assert.equal(unreadByStranger.status, 403, JSON.stringify(unreadByStranger.data));
    const notificationTamper = await request(`${documentsUrl}/notifications/${notificationId}`, {
      method: 'PATCH',
      token: admin.token,
      body: { fields: encodedFields({ type: 'request_rejected' }) }
    });
    assert.equal(notificationTamper.status, 403, JSON.stringify(notificationTamper.data));
    const markRead = await request(`${documentsUrl}/notifications/${notificationId}?updateMask.fieldPaths=isRead`, {
      method: 'PATCH',
      token: admin.token,
      body: { fields: encodedFields({ isRead: true }) }
    });
    expectSuccess(markRead, 'Coordinator marks response notification read');
  });

  await check('Provider response rules reject assignment changes, duplicate decisions, and forged notifications', async () => {
    const assignmentTamper = responseWrites({
      provider: reassignedProvider,
      status: 'accepted',
      notificationId: `${caseId}-assignment-tamper`
    });
    assignmentTamper[0].update.fields.providerUid = fieldValue(unassignedProvider.uid);
    assignmentTamper[0].updateMask.fieldPaths.push('providerUid');
    const assignmentTamperResult = await batchCommit(reassignedProvider.token, assignmentTamper);
    assert.equal(assignmentTamperResult.status, 403, JSON.stringify(assignmentTamperResult.data));

    const verificationTamper = await request(
      `${documentsUrl}/users/${reassignedProvider.uid}?updateMask.fieldPaths=isVerified`,
      {
        method: 'PATCH',
        token: reassignedProvider.token,
        body: { fields: encodedFields({ isVerified: false }) }
      }
    );
    assert.equal(verificationTamper.status, 403, JSON.stringify(verificationTamper.data));

    const duplicateResponse = await batchCommit(reassignedProvider.token, responseWrites({
      provider: reassignedProvider,
      status: 'rejected',
      reason: 'Conflicting duplicate decision',
      notificationId: `${caseId}-duplicate-response`
    }));
    assert.equal(duplicateResponse.status, 403, JSON.stringify(duplicateResponse.data));

    const forgedNotification = await createDocument(`notifications/${caseId}-forged-notification`, {
      recipientUid: admin.uid,
      type: 'request_rejected',
      title: 'Forged response',
      message: 'Not tied to a response transaction',
      relatedCaseId: caseId,
      relatedRequestId: requestDocument.requestId,
      responseProviderUid: reassignedProvider.uid,
      isRead: false,
      createdAt: new Date().toISOString()
    }, reassignedProvider.token);
    assert.equal(forgedNotification.status, 403, JSON.stringify(forgedNotification.data));
  });

  await check('Only coordinators can change request lifecycle status', async () => {
    const resetAcceptedRequest = await request(
      `${documentsUrl}/requests/${requestDocument.requestId}?updateMask.fieldPaths=status`,
      {
        method: 'PATCH',
        token: patient.token,
        body: { fields: encodedFields({ status: 'pending' }) }
      }
    );
    assert.equal(resetAcceptedRequest.status, 403, JSON.stringify(resetAcceptedRequest.data));

    const cancellableRequestId = `${requestDocument.requestId}-CANCEL`;
    await seed(`requests/${cancellableRequestId}`, {
      ...requestDocument,
      requestId: cancellableRequestId,
      status: 'REQUESTED'
    });
    const cancelled = await request(`${documentsUrl}/requests/${cancellableRequestId}?updateMask.fieldPaths=status`, {
      method: 'PATCH',
      token: patient.token,
      body: { fields: encodedFields({ status: 'CANCELLED' }) }
    });
    assert.equal(cancelled.status, 403, JSON.stringify(cancelled.data));
  });

  await check('Rejected responses require a reason and preserve notification ownership', async () => {
    const rejectedRequest = {
      ...requestDocument,
      requestId: `${requestDocument.requestId}-REJECT`,
      caseId: `${caseId}-REJECT`,
      providerUid: reassignedProvider.uid,
      assignmentCoordinatorUid: admin.uid,
      status: 'ASSIGNED'
    };
    const rejectedCase = { ...caseDocument, caseId: `${caseId}-REJECT` };
    await seed(`cases/${rejectedCase.caseId}`, rejectedCase);
    await seed(`requests/${rejectedRequest.requestId}`, rejectedRequest);

    const missingReason = responseWrites({
      provider: reassignedProvider,
      status: 'rejected',
      reason: ' ',
      notificationId: `${caseId}-missing-response-reason`,
      requestId: rejectedRequest.requestId,
      responseCaseId: rejectedCase.caseId
    });
    const missingReasonResult = await batchCommit(reassignedProvider.token, missingReason);
    assert.equal(missingReasonResult.status, 403, JSON.stringify(missingReasonResult.data));

    const validRejection = await batchCommit(reassignedProvider.token, responseWrites({
      provider: reassignedProvider,
      status: 'rejected',
      reason: 'No compatible blood inventory remains.',
      notificationId: `${caseId}-rejection-notification`,
      requestId: rejectedRequest.requestId,
      responseCaseId: rejectedCase.caseId
    }));
    expectSuccess(validRejection, 'Provider rejection with required reason');
    const rejectedRecord = await read(`requests/${rejectedRequest.requestId}`, reassignedProvider.token);
    expectSuccess(rejectedRecord, 'Rejected request readback');
    assert.equal(rejectedRecord.data.fields.status.stringValue, 'REJECTED');
    assert.equal(rejectedRecord.data.fields.rejectionReason.stringValue, 'No compatible blood inventory remains.');
  });

  await check('Hospital, oxygen, ambulance, and doctor request types accept only matching provider roles', async () => {
    const resourceProviders = [
      { provider: hospitalProvider, resourceType: 'hospital_admission' },
      { provider: oxygenProvider, resourceType: 'oxygen' },
      { provider: ambulanceProvider, resourceType: 'ambulance' },
      { provider: doctorProvider, resourceType: 'doctor_assistance' }
    ];

    for (const { provider, resourceType } of resourceProviders) {
      const assignedCaseId = `${caseId}-${resourceType}`;
      const assignedRequestId = `REQ-${assignedCaseId}-${resourceType}`;
      await seed(`cases/${assignedCaseId}`, {
        ...caseDocument,
        caseId: assignedCaseId
      });
      await seed(`requests/${assignedRequestId}`, {
        ...requestDocument,
        requestId: assignedRequestId,
        caseId: assignedCaseId,
        resourceType,
        providerUid: provider.uid,
        assignmentCoordinatorUid: admin.uid,
        status: 'ASSIGNED'
      });

      if (resourceType === 'oxygen') {
        const mismatchedRole = await batchCommit(hospitalProvider.token, responseWrites({
          provider: hospitalProvider,
          status: 'accepted',
          requestId: assignedRequestId,
          responseCaseId: assignedCaseId,
          notificationId: `${assignedRequestId}-wrong-role`
        }));
        assert.equal(mismatchedRole.status, 403, JSON.stringify(mismatchedRole.data));
      }

      if (resourceType === 'doctor_assistance') {
        const doctorCaseRead = await read(`cases/${assignedCaseId}`, doctorProvider.token);
        expectSuccess(doctorCaseRead, 'Doctor reads only a case linked to assigned doctor assistance');
        const unrelatedCaseRead = await read(`cases/${assignedCaseId}`, stranger.token);
        assert.equal(unrelatedCaseRead.status, 403, JSON.stringify(unrelatedCaseRead.data));
      }

      const response = await batchCommit(provider.token, responseWrites({
        provider,
        status: 'accepted',
        requestId: assignedRequestId,
        responseCaseId: assignedCaseId,
        resourceType,
        notificationId: `${assignedRequestId}-response`
      }));
      expectSuccess(response, `${resourceType} assigned provider response`);
    }
  });

  await check('Suspended patient cannot create a case or atomic case/request batch', async () => {
    const suspendedCaseId = `${caseId}-SUSPENDED`;
    const suspendedCase = {
      ...caseDocument,
      caseId: suspendedCaseId,
      patientUid: suspendedPatient.uid,
      requesterUid: suspendedPatient.uid
    };
    const caseResult = await createDocument(`cases/${suspendedCaseId}`, suspendedCase, suspendedPatient.token);
    assert.equal(caseResult.status, 403, JSON.stringify(caseResult.data));

    const suspendedRequest = {
      ...requestDocument,
      requestId: `REQ-${suspendedCaseId}-blood`,
      caseId: suspendedCaseId,
      patientUid: suspendedPatient.uid,
      requesterUid: suspendedPatient.uid
    };
    const batchResult = await batchCommit(suspendedPatient.token, [
      updateWrite(`cases/${suspendedCaseId}`, suspendedCase),
      updateWrite(`requests/${suspendedRequest.requestId}`, suspendedRequest)
    ]);
    assert.equal(batchResult.status, 403, JSON.stringify(batchResult.data));
  });

  await check('Attendant collection-group query returns only their active consent links', async () => {
    await seed(`users/${patient.uid}/attendants/${attendant.uid}`, {
      patientUid: patient.uid,
      attendantUid: attendant.uid,
      activeConsent: true,
      grantedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const directLink = await read(`users/${patient.uid}/attendants/${attendant.uid}`, attendant.token);
    expectSuccess(directLink, 'Attendant direct consent-link read');
    const result = await runQuery({
      from: [{ collectionId: 'attendants', allDescendants: true }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [stringFilter('attendantUid', attendant.uid), booleanFilter('activeConsent', true)]
        }
      }
    }, attendant.token);
    expectSuccess(result, 'Active attendant collection-group query');
    assert.equal(result.data.length, 1, JSON.stringify(result.data));
    const fields = result.data[0].document.fields;
    assert.equal(fields.patientUid.stringValue, patient.uid);
    assert.equal(fields.activeConsent.booleanValue, true);
  });

  await check('Attendant collection query reads linked cases with active consent', async () => {
    const result = await runQuery({
      from: [{ collectionId: 'cases' }],
      where: stringFilter('patientUid', patient.uid)
    }, attendant.token);
    expectSuccess(result, 'Active attendant linked-case query');
    const linkedCaseIds = result.data.map((item) => item.document.fields.caseId.stringValue);
    assert.ok(linkedCaseIds.includes(caseId), JSON.stringify(result.data));
  });

  await check('Admin reads a case with no dependency on assigned-provider request paths', async () => {
    const adminCaseId = `${caseId}-ADMIN`;
    await seed(`cases/${adminCaseId}`, { ...caseDocument, caseId: adminCaseId });
    const result = await read(`cases/${adminCaseId}`, admin.token);
    expectSuccess(result, 'Admin case get');
    assert.equal(result.data.fields.caseId.stringValue, adminCaseId);
  });

  await check('Coordinator can query users, cases, and requests while unrelated users cannot', async () => {
    const usersResult = await runQuery({ from: [{ collectionId: 'users' }] }, admin.token);
    const casesResult = await runQuery({ from: [{ collectionId: 'cases' }] }, admin.token);
    const requestsResult = await runQuery({ from: [{ collectionId: 'requests' }] }, admin.token);
    expectSuccess(usersResult, 'Coordinator users collection query');
    expectSuccess(casesResult, 'Coordinator cases collection query');
    expectSuccess(requestsResult, 'Coordinator requests collection query');
    assert.ok(usersResult.data.some((item) => item.document.name.endsWith(`/users/${patient.uid}`)));
    assert.ok(casesResult.data.some((item) => item.document.fields.caseId.stringValue === caseId));
    assert.ok(requestsResult.data.some((item) => item.document.fields.caseId.stringValue === caseId));

    const unauthorizedUsers = await runQuery({ from: [{ collectionId: 'users' }] }, stranger.token);
    const unauthorizedCases = await runQuery({ from: [{ collectionId: 'cases' }] }, stranger.token);
    const unauthorizedRequests = await runQuery({ from: [{ collectionId: 'requests' }] }, stranger.token);
    assert.equal(unauthorizedUsers.status, 403, JSON.stringify(unauthorizedUsers.data));
    assert.equal(unauthorizedCases.status, 403, JSON.stringify(unauthorizedCases.data));
    assert.equal(unauthorizedRequests.status, 403, JSON.stringify(unauthorizedRequests.data));
  });

  await check('Malformed legacy documents are denied without missing-field evaluation errors', async () => {
    const malformedCaseId = `${caseId}-MALFORMED`;
    const malformedLinkPath = `users/${stranger.uid}/attendants/${attendant.uid}`;
    await seed(`cases/${malformedCaseId}`, {
      caseId: malformedCaseId,
      conditionSummary: 'Malformed legacy record'
    });
    await seed(malformedLinkPath, { patientUid: stranger.uid, activeConsent: true });

    const malformedCase = await read(`cases/${malformedCaseId}`, stranger.token);
    const malformedLink = await read(malformedLinkPath, attendant.token);
    assert.equal(malformedCase.status, 403, JSON.stringify(malformedCase.data));
    assert.equal(malformedLink.status, 403, JSON.stringify(malformedLink.data));
  });

  await check('Case reads remain restricted to the owner, active attendant, current assigned provider, and admin', async () => {
    const ownerRead = await read(`cases/${caseId}`, patient.token);
    const attendantRead = await read(`cases/${caseId}`, attendant.token);
    const formerProviderRead = await read(`cases/${caseId}`, assignedProvider.token);
    const currentProviderRead = await read(`cases/${caseId}`, reassignedProvider.token);
    const unassignedRead = await read(`cases/${caseId}`, unassignedProvider.token);
    const strangerRead = await read(`cases/${caseId}`, stranger.token);
    const adminRead = await read(`cases/${caseId}`, admin.token);

    for (const [label, result] of [['owner', ownerRead], ['attendant', attendantRead], ['current assigned provider', currentProviderRead], ['admin', adminRead]]) {
      expectSuccess(result, `${label} case read`);
    }
    assert.equal(formerProviderRead.status, 403, JSON.stringify(formerProviderRead.data));
    assert.equal(unassignedRead.status, 403, JSON.stringify(unassignedRead.data));
    assert.equal(strangerRead.status, 403, JSON.stringify(strangerRead.data));
  });

  await check('Attendant collection-group and case queries stop working after consent revocation', async () => {
    const revoke = await batchCommit(patient.token, [{
      update: {
        name: `projects/${projectId}/databases/(default)/documents/users/${patient.uid}/attendants/${attendant.uid}`,
        fields: encodedFields({
          patientUid: patient.uid,
          attendantUid: attendant.uid,
          activeConsent: false,
          updatedAt: new Date().toISOString()
        })
      },
      updateMask: { fieldPaths: ['activeConsent', 'updatedAt'] }
    }]);
    expectSuccess(revoke, 'Patient consent revocation');

    const linkQuery = await runQuery({
      from: [{ collectionId: 'attendants', allDescendants: true }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [stringFilter('attendantUid', attendant.uid), booleanFilter('activeConsent', true)]
        }
      }
    }, attendant.token);
    expectSuccess(linkQuery, 'Revoked attendant filtered query');
    assert.equal(linkQuery.data.filter((item) => item.document).length, 0, JSON.stringify(linkQuery.data));

    const caseRead = await read(`cases/${caseId}`, attendant.token);
    assert.equal(caseRead.status, 403, JSON.stringify(caseRead.data));
  });

  console.log(`\nFirestore Rules Emulator tests: ${passed.length} passed.`);
} catch (error) {
  console.error(`FAIL: ${error?.stack || error}`);
  process.exitCode = 1;
}
