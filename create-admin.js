require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

// --- Configuration ---
// Change these values to set the credentials for your first admin user.
const newAdminUsername = 'admin';
const newAdminPassword = 'Governor123@$';
// ---------------------

const saltRounds = 10;

async function createAdmin() {
    let client;

    // Proactively check if the DATABASE_URL is set.
    if (!process.env.DATABASE_URL) {
        console.error('\n❌ ERROR: The DATABASE_URL environment variable is not set.');
        console.error('   Please create or check your .env file in the project root.');
        console.error('   It should contain your full Supabase connection string, including the password.');
        return; // Exit the function
    }

    try {
        console.log('Connecting to database...');
        
        // Only use SSL if connecting to a remote database (not localhost)
        const useSSL = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1');

        client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: useSSL ? { rejectUnauthorized: false } : undefined
        });
        await client.connect();
        console.log('Connected.');

        console.log(`Hashing password for user: ${newAdminUsername}...`);
        const hashedPassword = await bcrypt.hash(newAdminPassword, saltRounds);
        console.log('Password hashed.');

        const sql = 'INSERT INTO admins (username, password) VALUES ($1, $2)';
        await client.query(sql, [newAdminUsername, hashedPassword]);

        console.log(`\nSUCCESS: Admin user '${newAdminUsername}' created successfully.`);
        console.log('You can now log in with this user.');

    } catch (error) {
        console.error('\nERROR creating admin user:', error.message);
        if (error.message.includes('client password must be a string')) {
            console.error('   👉 This commonly means the password is missing from your DATABASE_URL.');
            console.error('   👉 Please ensure it looks like: postgresql://postgres:[YOUR-PASSWORD]@...');
        }
    } finally {
        if (client) await client.end();
    }
}

createAdmin();