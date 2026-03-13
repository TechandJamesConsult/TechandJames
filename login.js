document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const status = document.getElementById('loginStatus');
    const btn = this.querySelector('button');
    
    status.textContent = 'Logging in...';
    status.style.color = '#007BFF';
    btn.disabled = true;

    try {
        const response = await fetch('/app-api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            status.textContent = 'Success! Redirecting...';
            status.style.color = 'green';
            window.location.href = '/admin';
        } else {
            status.textContent = data.message || 'Login failed';
            status.style.color = 'red';
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        status.textContent = 'Error connecting to server';
        status.style.color = 'red';
        btn.disabled = false;
    }
});