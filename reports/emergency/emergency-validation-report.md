# Emergency E2E Validation Report

**Generated:** 2026-05-29T21:12:07.149Z

## Summary

| Metric | Value |
|--------|------:|
| Vitest files passed | 44/44 |
| Vitest tests passed | 8/8 |
| Registry cases (automated) | 18/22 |
| Automated coverage (registry) | 82% |
| P0 cases in registry | 12 |

## Result

**PASS**

## Vitest output (excerpt)

```

 RUN  v4.1.7 D:/PraniDoctor/pranidoctor-backend

 ✓ src/modules/emergency-validation/notifications.test.ts > notifications — emergency service request > NOTIF-SUBMIT: creates in-app notification and SMS on submit 11ms
 ✓ src/modules/emergency-validation/notifications.test.ts > notifications — emergency service request > NOTIF-ACCEPT: notifies customer when doctor accepts 2ms
 ✓ src/modules/emergency-validation/notifications.test.ts > notifications — emergency service request > NOTIF-COMPLETE: notifies on completion 2ms
 ✓ src/modules/emergency-validation/notifications.test.ts > notifications — emergency service request > E-04: swallows notification errors without throwing 12ms
 ✓ src/modules/emergency-validation/notifications.test.ts > notifications — emergency service request > skips SMS when phone missing 1ms
 ✓ src/modules/emergency-validation/notifications.test.ts > notifications — copy compliance > STATIC: notification body is legal-safe: Your Emergency Vet request was submitted successfully. 3ms
 ✓ src/modules/emergency-validation/notifications.test.ts > notifications — copy compliance > STATIC: notification body is legal-safe: Dr. Rahman accepted your service request. 2ms
 ✓ src/modules/emergency-validation/notifications.test.ts > notifications — copy compliance > STATIC: notification body is legal-safe: Your service request has been marked completed. 0ms
 ✓ src/modules/emergency-validation/notifications.test.ts > notifications — copy compliance > STATIC: notification body is legal-safe: A customer submitted a Emergency Vet request (pending assignment). 1ms
 ✓ src/modules/emergency-validation/emergency-limitation.test.ts > E2E-EM-LEGAL-01 — emergency limitation guard > allows non-emergency service types without check 7ms
 ✓ src/modules/emergency-validation/emergency-limitation.test.ts > E2E-EM-LEGAL-01 — emergency limitation guard > throws LEGAL_CONSENT_REQUIRED when acceptance missing 3ms
 ✓ src/modules/emergency-validation/emergency-limitation.test.ts > E2E-EM-LEGAL-01 — emergency limitation guard > passes when acceptance not required 3ms
 ✓ src/modules/emergency-validation/audit-timeline.test.ts > audit — timeline coverage > E2E-EM-CLOSE-01 / AUDIT-CHAIN: logs creation through completion 11ms
 ✓ src/modules/emergency-validation/audit-timeline.test.ts > audit — timeline coverage > logs rejection with doctor actor 1ms
 ✓ src/modules/emergency-validation/doctor-workflow.test.ts > doctor workflow — accept > E2E-EM-DOC-ACCEPT-01: accepts assigned emergency 11ms
 ✓ src/modules/emergency-validation/doctor-workflow.test.ts > doctor workflow — accept > rejects accept when not assigned to doctor 1ms
 ✓ src/modules/emergency-validation/doctor-workflow.test.ts > doctor workflow — reject > E2E-EM-DOC-REJECT-01: rejects assigned emergency 8ms
 ✓ src/modules/emergency-validation/doctor-workflow.test.ts > doctor workflow — reassignment > E2E-EM-REASSIGN-01: admin reassigns to second doctor 3ms
 ✓ src/modules/emergency-validation/doctor-workflow.test.ts > doctor workflow — reassignment > blocks assign to inactive doctor 4ms
 ✓ src/modules/emergency-validation/emergency-workflow.test.ts > emergency workflow — livestock > E2E-EM-LIVESTOCK-01: CATTLE emergency lifecycle 13ms
 ✓ src/modules/emergency-validation/emergency-workflow.test.ts > emergency workflow — livestock > E2E-EM-LIVESTOCK-01: GOAT emergency lifecycle 2ms
 ✓ src/modules/emergency-validation/emergency-workflow.test.ts > emergency workflow — livestock > E2E-EM-LIVESTOCK-01: POULTRY emergency lifecycle 2ms
 ✓ src/modules/emergency-validation/emergency-workflow.test.ts > emergency workflow — livestock > E2E-EM-LIVESTOCK-01: BUFFALO emergency lifecycle 2ms
 ✓ src/modules/emergency-validation/emergency-workflow.test.ts > emergency workflow — livestock > sets EMERGENCY priority on create 2ms
 ✓ src/modules/emergency-validation/emergency-workflow.test.ts > emergency workflow — pet > E2E-EM-PET-01: DOG emergency lifecycle 1ms
 ✓ src/modules/emergency-validation/emergency-workflow
```

## Workflows validated (automated)

- Livestock emergency SR lifecycle (API state machine)
- Pet emergency SR lifecycle
- Doctor accept / reject / reassignment
- Customer cancellation
- Timeline audit chain
- Notification handlers + failure swallowing
- Notification copy legal-safe scan
- AI symptom emergency detection + compliance copy
- Emergency limitation booking guard
- Ops escalation monitoring cycle (mocked metrics)
- No-doctor / terminal state failure guards

## Remaining gaps (manual / staging)

- E-03 Network interruption / offline outbox replay (mobile device lab)
- E-06 Full degraded-mode drill on live staging
- RR-01 Service restart / rollback on staging
- Push notification delivery (FCM) end-to-end
- Flutter integration_test for BookConsultation emergency UI
- Playwright admin assign + doctor panel on staging