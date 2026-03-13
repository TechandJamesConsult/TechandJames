document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.querySelector('#submissionsTable tbody');
    const searchInput = document.getElementById('searchInput');
    const serviceFilter = document.getElementById('serviceFilter');

    let allSubmissions = []; // To store all submissions for client-side filtering
    
    // Thread Modal Elements
    const threadModal = document.getElementById('threadModal');
    const closeThreadModalBtn = threadModal.querySelector('.close-button');
    const threadClientName = document.getElementById('threadClientName');
    const threadMessagesContainer = document.getElementById('threadMessages');
    const threadReplyForm = document.getElementById('threadReplyForm');
    const threadSubmissionIdInput = document.getElementById('threadSubmissionId');
    const threadReplyMessage = document.getElementById('threadReplyMessage');
    const sendThreadReplyBtn = document.getElementById('sendThreadReplyBtn');

    // Renders a given list of submissions to the table
    function renderSubmissions(submissionsToRender) {
        tableBody.innerHTML = ''; // Clear existing rows
        if (submissionsToRender.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No submissions found.</td></tr>`;
            return;
        }
        submissionsToRender.forEach(sub => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(sub.submitted_at).toLocaleDateString()}</td>
                <td>${sub.name}</td>
                <td>${sub.email}</td>
                <td>${sub.phone}</td>
                <td>${sub.service}</td>
                <td>
                    <button class="view-btn" data-id="${sub.id}" data-name="${sub.name}" data-email="${sub.email}">View</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Fetch submissions and populate the table
    async function fetchSubmissions() {
        try {
            const response = await fetch('/api/submissions');
            if (!response.ok) {
                throw new Error('Failed to fetch submissions');
            }
            allSubmissions = await response.json();
            renderSubmissions(allSubmissions);
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #dc3545;">${error.message}</td></tr>`;
        }
    }

    // Handle opening the reply modal
    tableBody.addEventListener('click', async function(e) {
        // --- View Thread Button ---
        if (e.target.classList.contains('view-btn')) {
            const submissionId = e.target.dataset.id;
            const clientName = e.target.dataset.name;
            const clientEmail = e.target.dataset.email;

            threadClientName.textContent = clientName;
            threadSubmissionIdInput.value = submissionId;
            threadMessagesContainer.innerHTML = '<p>Loading messages...</p>';
            threadModal.style.display = 'block';

            try {
                const response = await fetch(`/api/messages/${submissionId}`);
                if (!response.ok) throw new Error('Could not fetch messages.');
                const messages = await response.json();

                threadMessagesContainer.innerHTML = '';
                messages.forEach(msg => {
                    const bubble = document.createElement('div');
                    bubble.classList.add('message-bubble', msg.sender); // 'user' or 'admin'
                    bubble.innerHTML = `
                        <div class="sender-info">${msg.sender.toUpperCase()} · ${new Date(msg.sent_at).toLocaleString()}</div>
                        <div>${msg.body.replace(/\n/g, '<br>')}</div>
                    `;
                    threadMessagesContainer.appendChild(bubble);
                });
                // Scroll to the bottom
                threadMessagesContainer.scrollTop = threadMessagesContainer.scrollHeight;

            } catch (error) {
                threadMessagesContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
            }
            // Pass the email to the form for replying
            threadReplyForm.dataset.clientEmail = clientEmail;
        }
    });

    // Filter and Search Logic
    function filterAndSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        const filterValue = serviceFilter.value;

        const filteredSubmissions = allSubmissions.filter(sub => {
            const matchesSearch = searchTerm === '' ||
                sub.name.toLowerCase().includes(searchTerm) ||
                sub.email.toLowerCase().includes(searchTerm) ||
                sub.phone.toLowerCase().includes(searchTerm);
            
            const matchesFilter = filterValue === '' || sub.service === filterValue;

            return matchesSearch && matchesFilter;
        });
        renderSubmissions(filteredSubmissions);
    }

    // Handle closing the thread modal
    closeThreadModalBtn.onclick = function() {
        threadModal.style.display = 'none';
        threadReplyForm.reset();
    }

    // Add a single window click listener to close either modal
    window.addEventListener('click', (event) => {
        if (event.target == threadModal) threadModal.style.display = 'none';
    });

    // Handle reply from within the thread view
    threadReplyForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const originalBtnText = sendThreadReplyBtn.textContent;
        sendThreadReplyBtn.disabled = true;
        sendThreadReplyBtn.textContent = 'Sending...';

        const submissionId = threadSubmissionIdInput.value;
        const message = threadReplyMessage.value;
        // Get the email from the data attribute we stored on the form
        const toEmail = threadReplyForm.dataset.clientEmail;

        try {
            const response = await fetch('/api/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submission_id: submissionId, to: toEmail, message: message })
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: 'Server error (check terminal logs)' }));
                throw new Error(errData.message || 'Failed to send reply.');
            }

            // Add the new message to the view
            const bubble = document.createElement('div');
            bubble.classList.add('message-bubble', 'admin');
            bubble.innerHTML = `
                <div class="sender-info">ADMIN · Just now</div>
                <div>${message.replace(/\n/g, '<br>')}</div>
            `;
            threadMessagesContainer.appendChild(bubble);
            threadMessagesContainer.scrollTop = threadMessagesContainer.scrollHeight;
            threadReplyForm.reset();

        } catch (error) {
            console.error('Reply Submission Error:', error);
            alert(`Error: ${error.message}`);
        } finally {
            sendThreadReplyBtn.disabled = false;
            sendThreadReplyBtn.textContent = originalBtnText;
        }
    });

    // Event Listeners for controls
    searchInput.addEventListener('input', filterAndSearch);
    serviceFilter.addEventListener('change', filterAndSearch);
    // Initial fetch
    fetchSubmissions();
});