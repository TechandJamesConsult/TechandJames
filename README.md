# Tech & James Consult Platform

A web application for Tech & James Consult, facilitating study abroad services and consultations. This project includes a public-facing frontend and a secure admin dashboard for managing client submissions.

## Features

- **Public Interface**: Responsive landing page with services, testimonials, and contact forms.
- **Admin Dashboard**: Secure login to view, filter, and reply to client submissions.
- **Email Integration**: Automated email notifications using Nodemailer.
- **Database**: PostgreSQL (Supabase) integration for storing submissions and message threads.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (via Supabase)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Security**: Helmet, bcrypt, express-session

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Get this from your Supabase project > Settings > Database > Connection string (URI)
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxx.supabase.co:5432/postgres"
   
   # A long, random string for securing sessions
   SESSION_SECRET="your_super_secret_session_key"
   
   # Your SMTP server details for sending emails
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false # Use true for port 465
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_gmail_app_password 
   ```

3. **Run the Server**
   ```bash
   npm run dev
   ```