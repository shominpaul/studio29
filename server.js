// ===========================
// 📦 Required Dependencies
// ===========================
require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Unique IDs for bookings
const cors = require('cors'); // Cross-Origin Resource Sharing support

const app = express();
const PORT = process.env.PORT || 3000; // Use environment variable PORT or default to 3000

// ===========================
// 🛠️ Mock Database
// ===========================
let slots = []; // Stores booking details

// Store hours structures
let defaultHours = { openingHour: '09:00', closingHour: '18:00' };
let dailyStoreHours = {}; // { 'YYYY-MM-DD': { openingHour, closingHour, holiday } }

// ===========================
// 🌐 Middleware
// ===========================
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===========================
// 📧 Email Configuration
// ===========================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Accessed from environment variables
    pass: process.env.EMAIL_PASS  // Accessed from environment variables
  }
});

// ===========================
// 📄 Serve Pages
// ===========================
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);
app.get('/owner', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'owner.html'))
);

// ===========================
// 🕒 Store Hours Management
// ===========================

// POST /api/store-hours
app.post('/api/store-hours', (req, res) => {
  const { storeDate, openingHour, closingHour, holiday } = req.body;

  if (!storeDate) {
    return res.status(400).json({ error: '⚠️ Date is required.' });
  }

  if (holiday) {
    // Mark the date as a holiday
    dailyStoreHours[storeDate] = { holiday: true };
    console.log(`✅ Marked ${storeDate} as holiday.`);
    return res.json({
      message: `✅ ${storeDate} marked as holiday.`,
      dailyStoreHours
    });
  }

  // If not a holiday, validate opening and closing hours
  if (!openingHour || !closingHour) {
    return res.status(400).json({
      error: '⚠️ Both openingHour and closingHour are required if not a holiday.'
    });
  }

  if (openingHour >= closingHour) {
    return res.status(400).json({
      error: '⚠️ Opening hour must be earlier than closing hour.'
    });
  }

  // Update or set the store hours for the specific date
  dailyStoreHours[storeDate] = {
    openingHour,
    closingHour,
    holiday: false
  };

  console.log(`✅ Updated store hours for ${storeDate}:`, dailyStoreHours[storeDate]);
  res.json({
    message: `✅ Store hours updated for ${storeDate}.`,
    dailyStoreHours
  });
});

// GET /api/store-hours
app.get('/api/store-hours', (req, res) => {
  res.json({
    defaultHours,
    dailyStoreHours
  });
});

// ===========================
// 📅 Available Slots Calculation
// ===========================
app.post('/api/available-slots', (req, res) => {
  const { date, duration } = req.body;

  if (!date || !duration) {
    return res.status(400).json({ error: '⚠️ Date and duration are required.' });
  }

  // 1) Check if the date is a holiday
  const dailyEntry = dailyStoreHours[date];
  if (dailyEntry && dailyEntry.holiday) {
    console.log(`🚫 ${date} is marked as a holiday. No slots available.`);
    return res.json([]); // No slots available on holidays
  }

  // 2) Determine opening and closing hours for the date
  let openingHour, openingMinute, closingHour, closingMinute;

  if (dailyEntry && !dailyEntry.holiday) {
    // Use custom hours for the date
    [openingHour, openingMinute] = dailyEntry.openingHour.split(':').map(Number);
    [closingHour, closingMinute] = dailyEntry.closingHour.split(':').map(Number);
  } else {
    // Fallback to default hours
    [openingHour, openingMinute] = defaultHours.openingHour.split(':').map(Number);
    [closingHour, closingMinute] = defaultHours.closingHour.split(':').map(Number);
  }

  let currentHour = openingHour;
  let currentMinute = openingMinute;

  const availableSlots = [];

  while (
    currentHour < closingHour ||
    (currentHour === closingHour && currentMinute < closingMinute)
  ) {
    const startTime = `${String(currentHour).padStart(2, '0')}:${String(
      currentMinute
    ).padStart(2, '0')}`;

    // Calculate end time by adding duration
    const endTimeObj = new Date(0, 0, 0, currentHour, currentMinute + Number(duration));
    const formattedEndTime = `${String(endTimeObj.getHours()).padStart(2, '0')}:${String(
      endTimeObj.getMinutes()
    ).padStart(2, '0')}`;

    // Stop if the service end time goes beyond closing hour
    if (
      endTimeObj.getHours() > closingHour ||
      (endTimeObj.getHours() === closingHour && endTimeObj.getMinutes() > closingMinute)
    ) {
      break;
    }

    // Check for overlapping bookings
    const isOverlap = slots.some(
      (slot) =>
        slot.date === date &&
        ((startTime >= slot.startTime && startTime < slot.endTime) ||
          (formattedEndTime > slot.startTime &&
            formattedEndTime <= slot.endTime) ||
          (startTime <= slot.startTime &&
            formattedEndTime >= slot.endTime))
    );

    if (!isOverlap) {
      availableSlots.push({ startTime, endTime: formattedEndTime });
    }

    // Increment time by duration
    currentMinute += Number(duration);

    // Handle minutes overflow (>60)
    while (currentMinute >= 60) {
      currentHour += 1;
      currentMinute -= 60;
    }
  }

  console.log(`✅ Available slots for ${date}:`, availableSlots);
  res.json(availableSlots);
});

// ===========================
// 📅 Book a Slot
// ===========================
app.post('/api/book', (req, res) => {
  const { date, startTime, endTime, name, phone, email, services } = req.body;

  if (!date || !startTime || !endTime || !name || !phone || !email || !services) {
    return res
      .status(400)
      .json({ error: '⚠️ All fields are required.' });
  }

  // Optional Security Check: Ensure the date is not a holiday
  const dailyEntry = dailyStoreHours[date];
  if (dailyEntry && dailyEntry.holiday) {
    return res
      .status(400)
      .json({ error: '❌ Cannot book on a holiday.' });
  }

  const isOverlap = slots.some(
    (slot) =>
      slot.date === date &&
      ((startTime >= slot.startTime && startTime < slot.endTime) ||
        (endTime > slot.startTime && endTime <= slot.endTime) ||
        (startTime <= slot.startTime && endTime >= slot.endTime))
  );

  if (isOverlap) {
    return res
      .status(400)
      .json({ error: '❌ Slot overlaps with an existing booking.' });
  }

  const bookingId = uuidv4();

  slots.push({
    id: bookingId,
    date,
    startTime,
    endTime,
    name,
    phone,
    email,
    services,
    status: 'booked'
  });

  console.log('✅ Booking added:', { date, startTime, endTime, name, services });

  transporter.sendMail(
    {
      from: process.env.EMAIL_USER, // Use environment variable
      to: email,
      subject: 'Booking Confirmation',
      text: `✅ Your booking is confirmed!
📅 Date: ${date}
🕒 Time: ${startTime} to ${endTime}
💼 Services: ${services.join(', ')}`
    },
    (err) => {
      if (err) {
        console.error('❌ Email Error:', err);
        return res.status(500).json({ error: '❌ Error sending confirmation email.' });
      }
      res.json({ message: '✅ Booking confirmed!' });
    }
  );
});

// ===========================
// 📅 Booking Details, Edit, and Delete
// ===========================
app.get('/api/slots', (req, res) => {
  res.json(slots);
});

app.get('/api/booking/:id', (req, res) => {
  const { id } = req.params;
  const booking = slots.find((slot) => slot.id === id);
  if (!booking)
    return res.status(404).json({ error: '❌ Booking not found.' });
  res.json(booking);
});

app.put('/api/booking/:id', (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  const bookingIndex = slots.findIndex((slot) => slot.id === id);
  if (bookingIndex === -1)
    return res.status(404).json({ error: '❌ Booking not found.' });

  // Optional Security Check: Ensure that updating to a holiday date is not allowed
  if (updatedData.date) {
    const dailyEntry = dailyStoreHours[updatedData.date];
    if (dailyEntry && dailyEntry.holiday) {
      return res
        .status(400)
        .json({ error: '❌ Cannot update booking to a holiday date.' });
    }
  }

  // Check for overlapping bookings after update
  const { date, startTime, endTime } = updatedData;
  if (date && startTime && endTime) {
    const isOverlap = slots.some(
      (slot) =>
        slot.id !== id &&
        slot.date === date &&
        ((startTime >= slot.startTime && startTime < slot.endTime) ||
          (endTime > slot.startTime && endTime <= slot.endTime) ||
          (startTime <= slot.startTime && endTime >= slot.endTime))
    );

    if (isOverlap) {
      return res
        .status(400)
        .json({ error: '❌ Updated slot overlaps with an existing booking.' });
    }
  }

  slots[bookingIndex] = { ...slots[bookingIndex], ...updatedData };
  res.json({ message: '✅ Booking updated successfully.' });
});

app.delete('/api/booking/:id', (req, res) => {
  const { id } = req.params;
  const bookingExists = slots.some((slot) => slot.id === id);
  if (!bookingExists) {
    return res.status(404).json({ error: '❌ Booking not found.' });
  }

  slots = slots.filter((slot) => slot.id !== id);
  res.json({ message: '🗑️ Booking deleted successfully.' });
});

// ===========================
// 🚀 Start Server
// ===========================
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
