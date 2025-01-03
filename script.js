/* ===========================
📅 Show Booking and Works Sections
=========================== */
function showBooking() {
    document.getElementById('booking').classList.remove('hidden');
    document.getElementById('works').classList.add('hidden');
}

function showWorks() {
    document.getElementById('works').classList.remove('hidden');
    document.getElementById('booking').classList.add('hidden');
}

/* ===========================
📆 Calendar Integration
=========================== */
document.addEventListener('DOMContentLoaded', () => {
    const calendarEl = document.getElementById('calendar');

    if (calendarEl) {
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: async (fetchInfo, successCallback) => {
                try {
                    const response = await fetch('/api/slots');
                    const slots = await response.json();

                    const events = slots.map(slot => ({
                        title: slot.status === 'available' ? 'Available Slot' : `Booked: ${slot.name}`,
                        start: `${slot.date}T${slot.startTime}`,
                        end: `${slot.date}T${slot.endTime}`,
                        color: slot.status === 'available' ? '#2a9d8f' : '#e63946'
                    }));

                    successCallback(events);
                } catch (error) {
                    console.error('Error fetching slots:', error);
                }
            },
            dateClick: (info) => {
                document.getElementById('date').value = info.dateStr;
                document.getElementById('booking').classList.remove('hidden');
                fetchAvailableSlots();
            }
        });

        calendar.render();
    }
});

/* ===========================
🛠️ Store Hours Fetching
=========================== */
async function fetchStoreHours() {
    try {
        const response = await fetch('/api/store-hours');
        const hours = await response.json();
        return hours;
    } catch (error) {
        console.error('Error fetching store hours:', error);
        alert('🚨 Failed to fetch store hours. Please try again later.');
        return { openingHour: '09:00', closingHour: '18:00' };
    }
}

/* ===========================
🛠️ Service Selection Logic
=========================== */
const serviceCheckboxes = document.querySelectorAll('input[type="checkbox"][id^="service-"]');
const dateInput = document.getElementById('date');
const slotDropdown = document.getElementById('available-slots');

// Calculate total duration based on selected services
function calculateTotalDuration() {
    let totalDuration = 0;

    serviceCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            totalDuration += checkbox.value === 'Hair Colouring' ? 60 : 30;
        }
    });

    return totalDuration;
}

// Fetch available slots dynamically based on selected services, date, and store hours
async function fetchAvailableSlots() {
    const date = dateInput.value;
    const totalDuration = calculateTotalDuration();

    if (!date || totalDuration === 0) {
        slotDropdown.innerHTML = '<option value="">Select a slot</option>';
        return;
    }

    try {
        const storeHours = await fetchStoreHours();

        const response = await fetch('/api/available-slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date,
                duration: totalDuration,
                openingHour: storeHours.openingHour,
                closingHour: storeHours.closingHour
            })
        });

        const slots = await response.json();

        if (slots.length === 0) {
            slotDropdown.innerHTML = '<option value="">No available slots</option>';
        } else {
            slotDropdown.innerHTML = slots.map(slot => 
                `<option value="${slot.startTime}-${slot.endTime}">${slot.startTime} - ${slot.endTime}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Error fetching available slots:', error);
        alert('🚨 Error fetching available slots. Please try again.');
    }
}

// Event listeners for services and date selection
serviceCheckboxes.forEach(checkbox => checkbox.addEventListener('change', fetchAvailableSlots));
dateInput.addEventListener('change', fetchAvailableSlots);

/* ===========================
📅 Booking Form Submission
=========================== */
document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const date = dateInput.value;
    const selectedSlot = slotDropdown.value;
    const [startTime, endTime] = selectedSlot.split('-');
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const selectedServices = Array.from(serviceCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    if (!date || !startTime || !endTime || !name || !phone || !email || selectedServices.length === 0) {
        alert('⚠️ Please fill in all fields and select at least one service!');
        return;
    }

    try {
        const response = await fetch('/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, startTime, endTime, name, phone, email, services: selectedServices })
        });

        if (response.ok) {
            alert('🎉 Booking successful!');
            window.location.reload(); // Refresh to update calendar slots
        } else {
            alert('⚠️ Slot already taken or an error occurred.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('🚨 Server error. Please try again later.');
    }
});

/* ===========================
🛡️ Utility Functions
=========================== */
// Pre-fill current date in the booking form
if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
}

// Clear slots dropdown on page load
slotDropdown.innerHTML = '<option value="">Select a slot</option>';
