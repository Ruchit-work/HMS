## HMS End-to-End Test Checklist

- [ ] **Setup**
  - [ ] `.env.local` contains Firebase, Meta WhatsApp, Groq, etc.
  - [ ] `npm install` completes without warnings
  - [ ] `npm run lint` passes
  - [ ] `npm run build` succeeds (no TS errors)

- [ ] **Auth & Roles**
  - [ ] Patient email login / logout
  - [ ] Patient phone login via `/api/auth/lookup-identifier`
  - [ ] Admin / doctor / receptionist login
  - [ ] Unauthorized user blocked from restricted route

- [ ] **Patient Dashboard**
  - [ ] Overview widgets render counts correctly
  - [ ] Appointments list: filter, view, cancel/reschedule
  - [ ] Book appointment flow: select doctor, slot, payment, submit
  - [ ] Billing history shows pending invoice, settle payment updates status
  - [ ] Profile update saves changes (and validation errors show)

- [ ] **Doctor Dashboard**
  - [ ] Appointments load with correct statuses
  - [ ] Complete appointment: add notes, upload prescription, mark complete
  - [ ] AI Diagnosis call works (403 handled if VPN off)
  - [ ] Re-checkup request sends WhatsApp pick-date button with note

- [ ] **Receptionist Dashboard**
  - [ ] WhatsApp bookings tab lists pending items, badge updates
  - [ ] Assign doctor modal: autocomplete chief complaint, read-only fields respected
  - [ ] Manual booking form works (new patient + existing patient)
  - [ ] Billing history tab fetches data, filters, settles cash bookings

- [ ] **Admin Dashboard**
  - [ ] Stats cards and charts render
  - [ ] Campaign management CRUD (create, edit, delete, auto campaigns)
  - [ ] Patient management view modal shows appointment info

- [ ] **WhatsApp Flow**
  - [ ] Unknown user greeted, auto-registered, date/time/confirm flow works
  - [ ] Cancel keywords stop conversation
  - [ ] Selected slot reserved and appears in WhatsApp bookings list
  - [ ] Receptionist completes booking → confirmation sent to patient
  - [ ] Re-checkup link flow (doctor trigger → patient picks date/time)

- [ ] **Billing & Payments**
  - [ ] Pending cash appointment appears in receptionist & admin billing lists
  - [ ] Recording cash payment marks appointment confirmed, doctor sees it
  - [ ] Refund approval route updates appointment + audit log

- [ ] **Notifications & Logging**
  - [ ] WhatsApp notification utility sends manual test message
  - [ ] Audit logs written without errors (no undefined data)
  - [ ] Rate limiting blocks repeated API calls (check 429)

- [ ] **Scripts & Cleanup**
  - [ ] Auto-campaign cron endpoints (`check`, `generate`, `status`, `test`) respond OK
  - [ ] No unused exports (rerun `ts-prune`)
  - [ ] No duplicate code blocks >30 lines (`jscpd`)


