import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { NextRequest } from "next/server"
import { sendWhatsAppNotification } from "@/server/whatsapp"

interface Params {
  appointmentId: string
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  // Authenticate request - requires receptionist or admin role
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("receptionist whatsapp-bookings update API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured" }, { status: 500 })
    }

    const { appointmentId } = await context.params
    const body = await request.json()

    const firestore = admin.firestore()
    const appointmentRef = firestore.collection("appointments").doc(appointmentId)
    const appointmentDoc = await appointmentRef.get()

    if (!appointmentDoc.exists) {
      return Response.json(
        { error: "Appointment not found" },
        { status: 404 }
      )
    }

    const appointmentData = appointmentDoc.data()!

    // Validate that this is a WhatsApp booking
    if (!appointmentData.whatsappPending && appointmentData.status !== "whatsapp_pending") {
      return Response.json(
        { error: "This appointment is not a WhatsApp pending booking" },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    }

    // Doctor assignment
    if (body.doctorId) {
      const doctorDoc = await firestore.collection("doctors").doc(body.doctorId).get()
      if (!doctorDoc.exists) {
        return Response.json(
          { error: "Doctor not found" },
          { status: 404 }
        )
      }

      const doctorData = doctorDoc.data()!
      updateData.doctorId = body.doctorId
      updateData.doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
      updateData.doctorSpecialization = doctorData.specialization || ""

      // Update consultation fee if doctor has one
      if (doctorData.consultationFee) {
        updateData.consultationFee = doctorData.consultationFee
        updateData.totalConsultationFee = doctorData.consultationFee
        
        // Recalculate remaining amount
        const paymentAmount = body.paymentAmount !== undefined ? body.paymentAmount : (appointmentData.paymentAmount || 0)
        updateData.remainingAmount = Math.max(doctorData.consultationFee - paymentAmount, 0)
      }

      // Create appointment slot if doctor is assigned
      const appointmentDate = body.appointmentDate || appointmentData.appointmentDate
      const appointmentTime = body.appointmentTime || appointmentData.appointmentTime
      
      if (appointmentDate && appointmentTime) {
        const { normalizeTime } = await import("@/utils/timeSlots")
        const normalizedTime = normalizeTime(appointmentTime)
        const slotDocId = `${body.doctorId}_${appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
        const slotRef = firestore.collection("appointmentSlots").doc(slotDocId)
        
        // Check if slot is available (unless it's for this same appointment)
        const slotDoc = await slotRef.get()
        if (slotDoc.exists && slotDoc.data()?.appointmentId !== appointmentId) {
          return Response.json(
            { error: "Time slot is already booked for this doctor and date" },
            { status: 400 }
          )
        }

        // Update slot in transaction
        await firestore.runTransaction(async (transaction) => {
          const slotSnap = await transaction.get(slotRef)
          if (!slotSnap.exists || slotSnap.data()?.appointmentId === appointmentId) {
            transaction.set(slotRef, {
              appointmentId,
              doctorId: body.doctorId,
              appointmentDate,
              appointmentTime: normalizedTime,
              createdAt: new Date().toISOString(),
            }, { merge: true })
          } else {
            throw new Error("SLOT_ALREADY_BOOKED")
          }
        })
      }
    }

    // Update other fields
    if (body.patientName !== undefined) updateData.patientName = body.patientName
    if (body.patientPhone !== undefined) updateData.patientPhone = body.patientPhone
    if (body.patientEmail !== undefined) updateData.patientEmail = body.patientEmail
    if (body.appointmentDate !== undefined) updateData.appointmentDate = body.appointmentDate
    if (body.appointmentTime !== undefined) updateData.appointmentTime = body.appointmentTime
    if (body.chiefComplaint !== undefined) updateData.chiefComplaint = body.chiefComplaint
    if (body.medicalHistory !== undefined) updateData.medicalHistory = body.medicalHistory
    if (body.consultationFee !== undefined) {
      updateData.consultationFee = body.consultationFee
      updateData.totalConsultationFee = body.consultationFee
    }
    if (body.paymentAmount !== undefined) {
      updateData.paymentAmount = body.paymentAmount
      const consultationFee = updateData.consultationFee || appointmentData.consultationFee || 500
      updateData.remainingAmount = Math.max(consultationFee - body.paymentAmount, 0)
    }
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod
    if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus

    // Update status - if doctor is assigned, always mark as confirmed so it appears in appointment lists
    let shouldSendNotification = false
    if (updateData.doctorId && body.markConfirmed !== false) {
      // Always mark as confirmed when receptionist assigns doctor and saves
      updateData.status = "confirmed"
      updateData.whatsappPending = false
      shouldSendNotification = true // Send WhatsApp notification to patient
    }

    // Update appointment
    await appointmentRef.update(updateData)

    // Fetch updated appointment
    const updatedDoc = await appointmentRef.get()
    const updatedData = updatedDoc.data()!

    // Send WhatsApp notification to patient with doctor details
    if (shouldSendNotification && updateData.doctorId) {
      try {
        const patientPhone = updatedData.patientPhone || appointmentData.patientPhone
        if (patientPhone) {
          const patientName = updatedData.patientName || appointmentData.patientName || "Patient"
          const doctorName = updateData.doctorName || updatedData.doctorName
          const doctorSpecialization = updateData.doctorSpecialization || updatedData.doctorSpecialization || ""
          
          const appointmentDate = updatedData.appointmentDate || appointmentData.appointmentDate
          const appointmentTime = updatedData.appointmentTime || appointmentData.appointmentTime
          
          const dateDisplay = new Date(appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
          
          const [hours, minutes] = appointmentTime.split(":").map(Number)
          const timeDisplay = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
          
          const consultationFee = updatedData.totalConsultationFee || updatedData.consultationFee || appointmentData.consultationFee || 0
          const paymentAmount = updatedData.paymentAmount || appointmentData.paymentAmount || 0
          const paymentMethod = updatedData.paymentMethod || appointmentData.paymentMethod || "cash"
          const paymentStatus = updatedData.paymentStatus || appointmentData.paymentStatus || "pending"
          const remainingAmount = updatedData.remainingAmount || (consultationFee - paymentAmount)
          
          const message = `🎉 *Appointment Confirmed!*

Hi ${patientName},

Your appointment has been confirmed and booked successfully by our receptionist.

📋 *Appointment Details:*
• 👨‍⚕️ Doctor: ${doctorName}${doctorSpecialization ? ` (${doctorSpecialization})` : ""}
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 Appointment ID: ${appointmentId}
${updatedData.chiefComplaint ? `• 📝 Reason: ${updatedData.chiefComplaint}` : ""}

💳 *Payment Information:*
• Method: ${paymentMethod.toUpperCase()}
• Amount: ₹${paymentAmount}${remainingAmount > 0 ? ` (₹${remainingAmount} due)` : " (paid)"}
• Status: ${paymentStatus === "paid" ? "✅ Paid" : "⏳ Pending"}

✅ Your appointment is confirmed and visible in our system.

If you need to reschedule or have any questions, reply here or call us at +91-XXXXXXXXXX.

See you soon! 🏥`

          const result = await sendWhatsAppNotification({
            to: patientPhone,
            message,
          })

          if (result.success) {
            console.log("[WhatsApp Bookings API] ✅ Confirmation message sent successfully to:", patientPhone)
          } else {
            console.error("[WhatsApp Bookings API] ❌ Failed to send confirmation message:", {
              phone: patientPhone,
              error: result.error,
              errorCode: result.errorCode,
            })
          }
        } else {
          console.warn("[WhatsApp Bookings API] ⚠️ No phone number found, WhatsApp notification not sent. Patient:", patientName)
        }
      } catch (whatsappError: any) {
        console.error("[WhatsApp Bookings API] ❌ Error sending WhatsApp notification:", whatsappError)
        // Don't fail the update if WhatsApp fails
      }
    }

    return Response.json({
      success: true,
      appointment: {
        id: updatedDoc.id,
        ...updatedData,
      },
    })
  } catch (error: any) {
    console.error("[WhatsApp Bookings API] Error updating booking:", error)
    if (error.message === "SLOT_ALREADY_BOOKED") {
      return Response.json(
        { error: "Time slot is already booked" },
        { status: 400 }
      )
    }
    return Response.json(
      { error: "Failed to update WhatsApp booking", details: error.message },
      { status: 500 }
    )
  }
}

