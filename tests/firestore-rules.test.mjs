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
  return { uid, token: result.data.idToken };
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
  status: 'active',
  requestCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const patient = await createAccount('patient', 'patient');
const attendant = await createAccount('attendant', 'patientAttendant');
const stranger = await createAccount('stranger', 'patient');
const assignedProvider = await createAccount('assigned-provider', 'bloodBank');
const unassignedProvider = await createAccount('unassigned-provider', 'bloodBank');
const admin = await createAccount('admin', 'admin');
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
const caseDocument = { ...patientCase, patientUid: patient.uid, requesterUid: patient.uid };
const requestDocument = {
  requestId: `REQ-${caseId}-blood`,
  caseId,
  patientUid: patient.uid,
  requesterUid: patient.uid,
  providerUid: assignedProvider.uid,
  providerName: 'Rules Test Blood Bank',
  resourceType: 'blood',
  details: { bloodGroup: 'O+', units: 1 },
  status: 'pending',
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

  await check('Case reads remain restricted to the owner, active attendant, assigned provider, and admin', async () => {
    const ownerRead = await read(`cases/${caseId}`, patient.token);
    const attendantRead = await read(`cases/${caseId}`, attendant.token);
    const assignedRead = await read(`cases/${caseId}`, assignedProvider.token);
    const unassignedRead = await read(`cases/${caseId}`, unassignedProvider.token);
    const strangerRead = await read(`cases/${caseId}`, stranger.token);
    const adminRead = await read(`cases/${caseId}`, admin.token);

    for (const [label, result] of [['owner', ownerRead], ['attendant', attendantRead], ['assigned provider', assignedRead], ['admin', adminRead]]) {
      expectSuccess(result, `${label} case read`);
    }
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
