# Multi-Branch System Testing Guide

This guide provides step-by-step instructions to test all features of the multi-branch hospital management system.

## Prerequisites

1. Ensure you have admin access to the system
2. Have access to WhatsApp Business API (for WhatsApp booking tests)
3. Have test patient accounts ready
4. Ensure branches are seeded in the database

---

## Part 1: Branch Setup

### Test 1.1: Verify Branches Are Seeded

**Steps:**
1. Log in as **Super Admin** or **Admin**
2. Navigate to Admin Dashboard
3. Check if branches are available via API:
   - Open browser console
   - Run: `fetch('/api/branches').then(r => r.json()).then(console.log)`
   - Should return 3 branches: Surat (City Light), Navsari, and Bardoli

**Expected Result:**
- 3 branches with correct names and timings:
  - **Surat, City Light**: Mon-Sat, 6:00 PM - 9:00 PM
  - **Navsari**: Mon-Sat, 10:00 AM - 4:00 PM
  - **Bardoli**: Mon-Sat, 10:00 AM - 4:00 PM

**If branches are missing:**
- Navigate to `/api/branches/seed` (as admin) to seed branches

---

## Part 2: Receptionist Management

### Test 2.1: Create Receptionist with Branch Assignment

**Steps:**
1. Log in as **Admin**
2. Navigate to **Admin Dashboard** → **Receptionists** tab
3. Click **"Add Receptionist"** or **"Create Receptionist"**
4. Fill in the form:
   - First Name: `Test`
   - Last Name: `Receptionist Navsari`
   - Email: `receptionist.navsari@test.com`
   - Phone: `9876543210`
   - Password: `Test@123`
5. **Important:** Select **Branch**: `Navsari`
6. Click **"Create Receptionist"**

**Expected Result:**
- Receptionist created successfully
- Receptionist is assigned to Navsari branch
- Receptionist can log in with provided credentials

**Verify:**
- Log out as admin
- Log in as the created receptionist
- Check that receptionist only sees data for Navsari branch

### Test 2.2: Create Multiple Receptionists for Different Branches

**Steps:**
1. Create receptionist for **Surat** branch:
   - Email: `receptionist.surat@test.com`
   - Branch: `Surat, City Light`
2. Create receptionist for **Bardoli** branch:
   - Email: `receptionist.bardoli@test.com`
   - Branch: `Bardoli`

**Expected Result:**
- Each receptionist is assigned to their respective branch
- Each receptionist only sees their branch's data

---

## Part 3: Patient Management

### Test 3.1: Create Patient via Receptionist (Auto-Assignment)

**Steps:**
1. Log in as **Receptionist** (Navsari branch)
2. Navigate to **Receptionist Dashboard** → **Book Appointment** tab
3. Select **"New Patient"** mode
4. Fill in patient details:
   - First Name: `John`
   - Last Name: `Doe`
   - Email: `john.doe@test.com`
   - Phone: `9876543211`
   - Password: `Test@123`
5. Complete patient creation

**Expected Result:**
- Patient created successfully
- Patient automatically assigned to **Navsari** branch (receptionist's branch)
- Patient's `defaultBranchId` = Navsari branch ID
- Patient can log in with provided credentials

**Verify:**
- Log out as receptionist
- Log in as the created patient
- Check patient profile - should show Navsari as default branch

### Test 3.2: Patient Self-Registration via Portal

**Steps:**
1. Navigate to patient registration page (public signup)
2. Fill in registration form:
   - First Name: `Jane`
   - Last Name: `Smith`
   - Email: `jane.smith@test.com`
   - Phone: `9876543212`
   - Password: `Test@123`
3. **Important:** Select **Branch**: `Bardoli`
4. Complete registration

**Expected Result:**
- Patient registered successfully
- Patient's `defaultBranchId` = Bardoli branch ID
- Patient can log in

### Test 3.3: Patient Self-Registration via WhatsApp

**Steps:**
1. Send WhatsApp message to the hospital number: `hi` or `hello`
2. Follow the registration prompts
3. When asked for branch selection, choose a branch (e.g., `Surat, City Light`)

**Expected Result:**
- Patient registered via WhatsApp
- Patient's `defaultBranchId` = Selected branch ID
- Patient can book appointments

---

## Part 4: Doctor Management

### Test 4.1: Create Doctor with Multiple Branches

**Steps:**
1. Log in as **Admin**
2. Navigate to **Admin Dashboard** → **Doctors** tab
3. Click **"Add Doctor"** or **"Create Doctor"**
4. Fill in basic details:
   - First Name: `Dr. Test`
   - Last Name: `MultiBranch`
   - Email: `dr.multibranch@test.com`
   - Phone: `9876543213`
   - Specialization: `General Medicine`
   - Consultation Fee: `500`
   - Password: `Test@123`
5. **Branch Selection:**
   - Check **Surat, City Light**
   - Check **Navsari**
   - Check **Bardoli**
6. **Set Branch-Specific Timings:**
   - Click **"Set Timings"** for Surat
   - Set: Mon-Sat, 6:00 PM - 9:00 PM
   - Click **"Set Timings"** for Navsari
   - Set: Mon-Sat, 10:00 AM - 4:00 PM
   - Click **"Set Timings"** for Bardoli
   - Set: Mon-Sat, 10:00 AM - 4:00 PM
7. **Set General Visiting Hours** (fallback):
   - Mon-Sat: 9:00 AM - 5:00 PM
8. Click **"Save Doctor"**

**Expected Result:**
- Doctor created with `branchIds: ["surat", "navsari", "bardoli"]`
- Doctor has branch-specific timings for each branch
- Doctor has general visiting hours as fallback

**Verify:**
- Check doctor document in Firestore
- Verify `branchIds` array contains all 3 branch IDs
- Verify `branchTimings` object has timings for each branch

### Test 4.2: Create Doctor for Single Branch

**Steps:**
1. Create another doctor
2. Select only **Navsari** branch
3. Set branch-specific timings for Navsari only
4. Save

**Expected Result:**
- Doctor created with `branchIds: ["navsari"]`
- Doctor has timings only for Navsari branch

---

## Part 5: Portal Booking Flow

### Test 5.1: Patient Books Appointment at Default Branch

**Steps:**
1. Log in as **Patient** (created in Test 3.1 - assigned to Navsari)
2. Navigate to **Book Appointment** page
3. **Step 1 - Branch Selection:**
   - Should show **Navsari** pre-selected (default branch)
   - Click **"Next"**
4. **Confirmation Message:**
   - Should show: "Are you sure you chose this branch?"
   - Click **"Yes, Continue"**
5. **Step 2 - Select Date:**
   - Choose a date (Mon-Sat)
6. **Step 3 - Select Doctor:**
   - Should show doctors available at Navsari branch
   - Select a doctor
7. **Step 4 - Select Time:**
   - **Important:** Time slots should show **10:00 AM - 4:00 PM** (Navsari branch timings)
   - Select a time slot
8. **Step 5 - Symptoms & Details:**
   - Fill in symptoms
   - Complete booking

**Expected Result:**
- Appointment created with `branchId: "navsari"`
- Time slots shown match Navsari branch timings (10 AM - 4 PM)
- Appointment confirmation shows Navsari branch

### Test 5.2: Patient Books Appointment at Different Branch

**Steps:**
1. Log in as **Patient** (assigned to Navsari)
2. Navigate to **Book Appointment** page
3. **Step 1 - Branch Selection:**
   - Change branch to **Surat, City Light**
   - Click **"Next"**
4. **Confirmation Message:**
   - Confirm branch change
5. **Step 2 - Select Date:**
   - Choose a date (Mon-Sat)
6. **Step 3 - Select Doctor:**
   - Should show doctors available at Surat branch
   - Select a doctor (preferably one with Surat branch timings)
7. **Step 4 - Select Time:**
   - **Important:** Time slots should show **6:00 PM - 9:00 PM** (Surat branch timings)
   - Select a time slot
8. Complete booking

**Expected Result:**
- Appointment created with `branchId: "surat"`
- Time slots shown match Surat branch timings (6 PM - 9 PM)
- Patient can book at different branch than their default

### Test 5.3: New Patient Books Appointment (No Default Branch)

**Steps:**
1. Log in as **New Patient** (no default branch set)
2. Navigate to **Book Appointment** page
3. **Step 1 - Branch Selection:**
   - Must select a branch (no default)
   - Select **Bardoli**
   - Click **"Next"**
4. Complete booking flow

**Expected Result:**
- Patient must select a branch before proceeding
- Appointment created with selected branch ID

---

## Part 6: WhatsApp Booking Flow

### Test 6.1: Existing Patient Books via WhatsApp (Default Branch)

**Steps:**
1. Send WhatsApp message: `hi` or `hello`
2. Click **"Book Appointment"** button
3. **Language Selection:**
   - Select **English** or **Gujarati**
4. **Branch Selection:**
   - Should show branch information
   - Should show patient's default branch (e.g., Navsari)
   - Click **"Next (Use Default)"** button
5. **Date Selection:**
   - Select a date
6. **Time Selection:**
   - **Important:** Time slots should match branch timings
   - Select a time
7. Complete booking

**Expected Result:**
- Branch selection shows default branch
- "Next" button allows using default branch
- Appointment created with default branch ID
- Time slots match branch timings

### Test 6.2: Existing Patient Books via WhatsApp (Change Branch)

**Steps:**
1. Send WhatsApp message: `hi`
2. Click **"Book Appointment"** button
3. Select language
4. **Branch Selection:**
   - Click **"Click here to change branch"** or select different branch
   - Select **Surat, City Light**
5. Continue with date and time selection
6. **Important:** Verify time slots show **6:00 PM - 9:00 PM**

**Expected Result:**
- Patient can change branch during booking
- Appointment created with selected branch ID
- Time slots match selected branch timings

### Test 6.3: New Patient Registers and Books via WhatsApp

**Steps:**
1. Send WhatsApp message from new number: `hi`
2. Follow registration prompts
3. When asked for branch, select a branch
4. Complete registration
5. Book appointment (should use selected branch as default)

**Expected Result:**
- Patient registered with selected branch
- Booking flow uses selected branch as default

---

## Part 7: Admin Dashboard Branch Filtering

### Test 7.1: View All Branches Data

**Steps:**
1. Log in as **Admin**
2. Navigate to **Admin Dashboard** → **Overview** tab
3. **Branch Filter:**
   - Select **"All Branches"**
4. Check statistics:
   - Total Patients
   - Total Appointments
   - Today's Appointments
   - Revenue

**Expected Result:**
- Shows combined data from all branches
- All statistics reflect all branches

### Test 7.2: Filter by Specific Branch

**Steps:**
1. In Admin Dashboard Overview
2. **Branch Filter:**
   - Select **"Navsari"**
3. Check statistics

**Expected Result:**
- Statistics show only Navsari branch data
- Patients count = only Navsari patients
- Appointments count = only Navsari appointments

### Test 7.3: Appointment Management with Branch Filter

**Steps:**
1. Navigate to **Admin Dashboard** → **Appointments** tab
2. **Branch Filter:**
   - Select **"Surat, City Light"**
3. Check appointment list

**Expected Result:**
- Only appointments for Surat branch are shown
- Can filter by branch, doctor, time range, and status simultaneously

---

## Part 8: Receptionist Dashboard Branch Filtering

### Test 8.1: Receptionist Sees Only Their Branch Data

**Steps:**
1. Log in as **Receptionist** (Navsari branch)
2. Navigate to **Receptionist Dashboard**
3. Check **Dashboard Overview:**
   - Today's Appointments
   - Pending WhatsApp Bookings
   - Pending Billing

**Expected Result:**
- All data shown is for Navsari branch only
- Cannot see appointments from other branches

### Test 8.2: Receptionist Creates Patient

**Steps:**
1. Log in as **Receptionist** (Navsari)
2. Create a new patient
3. Book appointment for that patient

**Expected Result:**
- Patient automatically assigned to Navsari branch
- Appointment created with Navsari branch ID

### Test 8.3: Receptionist Views Appointments

**Steps:**
1. Log in as **Receptionist** (Surat branch)
2. Navigate to **Appointments** tab
3. Check appointment list

**Expected Result:**
- Only Surat branch appointments visible
- Cannot see appointments from Navsari or Bardoli

---

## Part 9: Time Slots Verification

### Test 9.1: Verify Branch Timings in Portal

**Steps:**
1. Log in as **Patient**
2. Start booking appointment
3. Select **Surat, City Light** branch
4. Select a doctor
5. Select a date (Mon-Sat)
6. Check available time slots

**Expected Result:**
- Time slots show: **6:00 PM - 9:00 PM** (Surat timings)
- No slots before 6 PM or after 9 PM

### Test 9.2: Verify Branch Timings for Navsari

**Steps:**
1. Select **Navsari** branch
2. Select doctor and date
3. Check time slots

**Expected Result:**
- Time slots show: **10:00 AM - 4:00 PM** (Navsari timings)
- No slots before 10 AM or after 4 PM

### Test 9.3: Verify Doctor Branch-Specific Timings Override

**Steps:**
1. Create a doctor with custom timings for Navsari:
   - General timings: 9 AM - 5 PM
   - Navsari branch timings: 11 AM - 3 PM
2. Book appointment at Navsari with this doctor
3. Check time slots

**Expected Result:**
- Time slots show: **11:00 AM - 3:00 PM** (doctor's branch-specific timings)
- Branch-specific timings override general timings

### Test 9.4: Verify Fallback to General Timings

**Steps:**
1. Create a doctor with:
   - General timings: 9 AM - 5 PM
   - No branch-specific timings for Navsari
2. Book appointment at Navsari with this doctor
3. Check time slots

**Expected Result:**
- Time slots show: **9:00 AM - 5:00 PM** (general timings)
- Falls back to general timings when branch-specific not set

---

## Part 10: Cross-Branch Scenarios

### Test 10.1: Patient Books at Multiple Branches

**Steps:**
1. Log in as **Patient** (default: Navsari)
2. Book appointment at **Navsari** branch
3. Book another appointment at **Surat** branch
4. Book another appointment at **Bardoli** branch

**Expected Result:**
- All appointments created successfully
- Each appointment has correct `branchId`
- Patient can have appointments at multiple branches

### Test 10.2: Doctor Works at Multiple Branches

**Steps:**
1. Create appointment with doctor who works at all 3 branches
2. Book at Navsari - verify Navsari timings
3. Book at Surat - verify Surat timings
4. Book at Bardoli - verify Bardoli timings

**Expected Result:**
- Same doctor can have appointments at different branches
- Each appointment uses correct branch timings
- Doctor's schedule shows appointments across all branches

---

## Part 11: Data Verification

### Test 11.1: Verify Firestore Data Structure

**Check Patient Document:**
```javascript
// Should have:
{
  defaultBranchId: "navsari_branch_id",
  defaultBranchName: "Navsari",
  // ... other fields
}
```

**Check Receptionist Document:**
```javascript
// Should have:
{
  branchId: "navsari_branch_id",
  // ... other fields
}
```

**Check Doctor Document:**
```javascript
// Should have:
{
  branchIds: ["surat_branch_id", "navsari_branch_id", "bardoli_branch_id"],
  visitingHours: { /* general timings */ },
  branchTimings: {
    "surat_branch_id": { /* Surat timings */ },
    "navsari_branch_id": { /* Navsari timings */ },
    "bardoli_branch_id": { /* Bardoli timings */ }
  }
}
```

**Check Appointment Document:**
```javascript
// Should have:
{
  branchId: "navsari_branch_id",
  branchName: "Navsari",
  // ... other fields
}
```

---

## Part 12: Edge Cases

### Test 12.1: Patient with No Default Branch

**Steps:**
1. Create patient without default branch (legacy patient)
2. Try to book appointment

**Expected Result:**
- Patient must select a branch
- Cannot proceed without branch selection

### Test 12.2: Doctor with No Branch Assignment

**Steps:**
1. Create doctor without branch assignment
2. Try to book appointment with this doctor

**Expected Result:**
- Doctor should not appear in branch-specific doctor lists
- Or should use general timings if shown

### Test 12.3: Branch Timings on Sunday

**Steps:**
1. Try to book appointment on Sunday
2. Check time slots

**Expected Result:**
- No time slots available (all branches closed on Sunday)
- Appropriate message shown

---

## Troubleshooting

### Issue: Branches not showing in forms
**Solution:**
- Check if branches are seeded: `/api/branches/seed`
- Verify active hospital ID is set
- Check browser console for API errors

### Issue: Time slots not matching branch timings
**Solution:**
- Verify doctor has branch-specific timings set
- Check branch timings in branch document
- Verify `getVisitingHoursForBranch` function is being called correctly

### Issue: Receptionist seeing all branches' data
**Solution:**
- Verify receptionist's `branchId` is set in Firestore
- Check receptionist dashboard filtering logic
- Verify `receptionistBranchId` is being passed correctly

### Issue: Patient not auto-assigned to branch
**Solution:**
- Verify receptionist has `branchId` set
- Check patient creation API route
- Verify `defaultBranchId` is being set during creation

---

## Test Checklist

- [ ] Branches seeded and visible
- [ ] Receptionist created with branch assignment
- [ ] Patient auto-assigned to receptionist's branch
- [ ] Patient self-registration with branch selection
- [ ] Doctor created with multiple branches
- [ ] Doctor branch-specific timings set correctly
- [ ] Portal booking with default branch
- [ ] Portal booking with branch change
- [ ] WhatsApp booking with default branch
- [ ] WhatsApp booking with branch change
- [ ] Time slots match branch timings (Surat: 6-9 PM)
- [ ] Time slots match branch timings (Navsari: 10 AM-4 PM)
- [ ] Time slots match branch timings (Bardoli: 10 AM-4 PM)
- [ ] Admin dashboard shows all branches data
- [ ] Admin dashboard filters by branch correctly
- [ ] Receptionist sees only their branch data
- [ ] Cross-branch booking works
- [ ] Doctor works at multiple branches correctly
- [ ] Firestore data structure correct

---

## Notes

- All timings are in 24-hour format
- Branch timings override doctor general timings
- Doctor branch-specific timings override branch default timings
- Sunday is closed for all branches
- Patients can book at any branch regardless of default branch
- Receptionists can only see/manage their assigned branch data
- Admins can see all branches or filter by specific branch

---

**Last Updated:** [Current Date]
**Version:** 1.0

