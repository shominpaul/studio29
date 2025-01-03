/* ===========================
🕒 Store Hours Management
=========================== */

// Store Hours Data
let defaultHours = { openingHour: '09:00', closingHour: '18:00' };
let dailyStoreHours = {};

// Fetch and Display Store Hours (Default and Daily)
async function fetchStoreHours() {
    try {
        const response = await fetch('/api/store-hours');
        if (!response.ok) throw new Error('Failed to fetch store hours');

        const data = await response.json();
        defaultHours = data.defaultHours;
        dailyStoreHours = data.dailyStoreHours;

        console.log('Store hours data:', data);
    } catch (error) {
        console.error('❌ Error fetching store hours:', error);
        alert('⚠️ Could not fetch store hours. Please check your server.');
    }
}

// Fetch store hours for a specific date and pre-fill the form
async function fetchStoreHoursForDate(storeDate) {
    try {
        const response = await fetch('/api/store-hours');
        if (!response.ok) throw new Error('Failed to fetch store hours');

        const data = await response.json();
        defaultHours = data.defaultHours;
        dailyStoreHours = data.dailyStoreHours;

        // Check if the selected date has custom store hours
        const dailyEntry = dailyStoreHours[storeDate];

        if (dailyEntry) {
            if (dailyEntry.holiday) {
                document.getElementById('isHoliday').checked = true;
                document.getElementById('openingHour').disabled = true;
                document.getElementById('closingHour').disabled = true;
                document.getElementById('openingHour').value = '';
                document.getElementById('closingHour').value = '';
            } else {
                document.getElementById('isHoliday').checked = false;
                document.getElementById('openingHour').disabled = false;
                document.getElementById('closingHour').disabled = false;
                document.getElementById('openingHour').value = dailyEntry.openingHour;
                document.getElementById('closingHour').value = dailyEntry.closingHour;
            }
        } else {
            // No custom entry, use default hours
            document.getElementById('isHoliday').checked = false;
            document.getElementById('openingHour').disabled = false;
            document.getElementById('closingHour').disabled = false;
            document.getElementById('openingHour').value = defaultHours.openingHour;
            document.getElementById('closingHour').value = defaultHours.closingHour;
        }
    } catch (error) {
        console.error('❌ Error fetching store hours for date:', error);
        alert('⚠️ Could not fetch store hours for the selected date.');
    }
}

// Update Store Hours (now date-specific + holiday)
document.getElementById('store-hours-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1) Gather form data
    const storeDate = document.getElementById('storeDate').value;
    const openingHour = document.getElementById('openingHour').value || null;
    const closingHour = document.getElementById('closingHour').value || null;
    const isHoliday = document.getElementById('isHoliday').checked;

    // 2) Validate
    if (!storeDate) {
        alert('⚠️ Please select a date for store hours.');
        return;
    }

    // If the day is not marked as a holiday, we need valid opening/closing hours
    if (!isHoliday) {
        if (!openingHour || !closingHour) {
            alert('⚠️ Please fill in both opening and closing hours, or mark it as holiday.');
            return;
        }
        if (openingHour >= closingHour) {
            alert('⚠️ Closing hour must be later than opening hour.');
            return;
        }
    }

    // 3) Send request to server
    try {
        const response = await fetch('/api/store-hours', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storeDate,
                openingHour: isHoliday ? null : openingHour,
                closingHour: isHoliday ? null : closingHour,
                holiday: isHoliday
            })
        });

        if (response.ok) {
            const data = await response.json();
            alert(data.message || '✅ Store hours updated successfully!');
            // Optionally re-fetch the store hours to update your UI
            // fetchStoreHours();
        } else {
            const errorMsg = await response.text();
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('❌ Error updating store hours:', error);
        alert('🚨 Error updating store hours. Please try again later.');
    }
});

// Optional: Disable/Enable openingHour and closingHour based on isHoliday checkbox
document.getElementById('isHoliday').addEventListener('change', function () {
    if (this.checked) {
        document.getElementById('openingHour').disabled = true;
        document.getElementById('closingHour').disabled = true;
        document.getElementById('openingHour').value = '';
        document.getElementById('closingHour').value = '';
    } else {
        document.getElementById('openingHour').disabled = false;
        document.getElementById('closingHour').disabled = false;
        // Optionally, set to default hours or previous values
    }
});

/* ===========================
📅 Booking Management (Owner Side)
=========================== */

// Calculate Total Duration Based on Selected Services
function calculateTotalDuration() {
    let totalDuration = 0;
    const serviceCheckboxes = document.querySelectorAll('input[type="checkbox"][id^="service-"]');

    serviceCheckboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            // "Hair Colour" => 60 min, otherwise => 30 min
            totalDuration += checkbox.value === 'Hair Colour' ? 60 : 30;
        }
    });

    return totalDuration;
}

// Fetch Available Slots Based on Date + Service Duration
async function fetchAvailableSlots() {
    const date = document.getElementById('date').value;
    const totalDuration = calculateTotalDuration();

    if (!date || totalDuration === 0) {
        document.getElementById('available-slots').innerHTML = '<option value="">Select a slot</option>';
        return;
    }

    try {
        const response = await fetch('/api/available-slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, duration: totalDuration })
        });

        if (!response.ok) throw new Error('Failed to fetch available slots');

        const slots = await response.json();
        if (slots.length === 0) {
            document.getElementById('available-slots').innerHTML = '<option value="">No available slots</option>';
        } else {
            document.getElementById('available-slots').innerHTML = slots
                .map((slot) => `<option value="${slot.startTime}-${slot.endTime}">${slot.startTime} - ${slot.endTime}</option>`)
                .join('');
        }
    } catch (error) {
        console.error('❌ Error fetching available slots:', error);
        alert('⚠️ Error fetching available slots. Please try again.');
    }
}

// Attach listeners for calculating available slots
document.querySelectorAll('input[type="checkbox"][id^="service-"]').forEach((checkbox) => {
    checkbox.addEventListener('change', fetchAvailableSlots);
});
document.getElementById('date').addEventListener('change', fetchAvailableSlots);

// Booking Appointment
document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const date = document.getElementById('date').value;
    const selectedSlot = document.getElementById('available-slots').value; // e.g., "09:00-09:30"
    const [startTime, endTime] = selectedSlot.split('-');
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const selectedServices = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(
        (checkbox) => checkbox.value
    );

    if (!date || !startTime || !endTime || !name || !phone || !email || selectedServices.length === 0) {
        alert('⚠️ Please fill in all fields and select at least one service!');
        return;
    }

    try {
        const response = await fetch('/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date,
                startTime,
                endTime,
                name,
                phone,
                email,
                services: selectedServices
            })
        });

        if (response.ok) {
            alert('✅ Appointment booked successfully!');
            calendar.refetchEvents(); // Refresh FullCalendar
        } else {
            const errorMsg = await response.text();
            alert(`❌ Error: ${errorMsg}`);
        }
    } catch (error) {
        console.error('❌ Error booking appointment:', error);
        alert('🚨 Server error. Please try again later.');
    }
});

/* ===========================
📆 Calendar + Edit/Delete Modal
=========================== */
const modal = document.getElementById('bookingModal');
const modalClose = document.getElementById('closeModal');
const modalForm = document.getElementById('modal-form');
const deleteBookingBtn = document.getElementById('deleteBooking');

const calendarEl = document.getElementById('calendar');
const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'timeGridWeek,timeGridDay'
    },
    events: async (fetchInfo, successCallback) => {
        try {
            const response = await fetch('/api/slots');
            if (!response.ok) throw new Error('Failed to fetch slots');

            const slots = await response.json();
            const events = slots.map((slot) => ({
                id: slot.id, // used to fetch/edit
                title: slot.status === 'booked' ? `📅 ${slot.name}` : 'Available Slot',
                start: `${slot.date}T${slot.startTime}`,
                end: `${slot.date}T${slot.endTime}`,
                color: slot.status === 'booked' ? '#e63946' : '#2a9d8f'
            }));

            successCallback(events);
        } catch (error) {
            console.error('❌ Error fetching slots:', error);
            alert('⚠️ Failed to fetch slots. Please try again later.');
        }
    },

    eventClick: async (info) => {
        // Only open modal if it's a booked event
        if (info.event.title.includes('Available Slot')) {
            return;
        }

        const bookingId = info.event.id;
        try {
            const response = await fetch(`/api/booking/${bookingId}`);
            if (!response.ok) throw new Error('Failed to fetch booking details');

            const bookingData = await response.json();
            // Populate modal fields
            document.getElementById('modalName').value = bookingData.name;
            document.getElementById('modalDate').value = bookingData.date;
            document.getElementById('modalStartTime').value = bookingData.startTime;
            document.getElementById('modalEndTime').value = bookingData.endTime;
            document.getElementById('modalPhone').value = bookingData.phone;
            document.getElementById('modalEmail').value = bookingData.email;

            // Store the booking ID
            modalForm.dataset.bookingId = bookingId;

            // Show the modal
            modal.style.display = 'block';
        } catch (error) {
            console.error('❌ Error fetching booking details:', error);
            alert('⚠️ Failed to load booking details.');
        }
    }
});

// Close modal on X
modalClose.onclick = () => {
    modal.style.display = 'none';
};

// Initialize Calendar & fetch store hours on page load
document.addEventListener('DOMContentLoaded', () => {
    calendar.render();
    fetchStoreHours();
});

// Event listener for storeDate input to fetch and pre-fill store hours
document.getElementById('storeDate').addEventListener('change', (e) => {
    const selectedDate = e.target.value;
    if (selectedDate) {
        fetchStoreHoursForDate(selectedDate);
    }
});

// "Save Changes" (PUT) from modal
modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const bookingId = modalForm.dataset.bookingId;
    const updatedName = document.getElementById('modalName').value;
    const updatedDate = document.getElementById('modalDate').value;
    const updatedStartTime = document.getElementById('modalStartTime').value;
    const updatedEndTime = document.getElementById('modalEndTime').value;
    const updatedPhone = document.getElementById('modalPhone').value;
    const updatedEmail = document.getElementById('modalEmail').value;

    try {
        const response = await fetch(`/api/booking/${bookingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: updatedName,
                date: updatedDate,
                startTime: updatedStartTime,
                endTime: updatedEndTime,
                phone: updatedPhone,
                email: updatedEmail
                // If you want to allow editing services, handle here
            })
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg);
        }

        alert('✅ Booking updated successfully.');
        modal.style.display = 'none';
        calendar.refetchEvents();
    } catch (error) {
        console.error('❌ Error updating booking:', error);
        alert('❌ Error updating booking. Please try again.');
    }
});

// "Delete Booking" (DELETE)
deleteBookingBtn.addEventListener('click', async () => {
    const bookingId = modalForm.dataset.bookingId;
    if (!confirm('Are you sure you want to delete this booking?')) {
        return;
    }

    try {
        const response = await fetch(`/api/booking/${bookingId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg);
        }

        alert('🗑️ Booking deleted successfully.');
        modal.style.display = 'none';
        calendar.refetchEvents();
    } catch (error) {
        console.error('❌ Error deleting booking:', error);
        alert('❌ Error deleting booking. Please try again.');
    }
});
