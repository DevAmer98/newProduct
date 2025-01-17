/*import { Pool } from 'pg';

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});


export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    console.log('Starting transaction...');
    await client.query('BEGIN'); // Start transaction

    // Parse the request body
    const { email, role, fcmToken } = await request.json();
    console.log('Request body:', { email, role, fcmToken });

    if (!email || !role || !fcmToken) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update the FCM token in the database based on the role
    let query;
    switch (role) {
      case 'supervisor':
        query = 'UPDATE Supervisors SET fcm_token = $1 WHERE email = $2';
        break;
      case 'driver':
        query = 'UPDATE Drivers SET fcm_token = $1 WHERE email = $2';
        break;
      case 'storekeeper':
        query = 'UPDATE Storekeepers SET fcm_token = $1 WHERE email = $2';
        break;
      default:
        console.error('Invalid role:', role);
        return new Response(
          JSON.stringify({ success: false, error: `Invalid role: ${role}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    console.log('Executing query:', query);
    const result = await client.query(query, [fcmToken, email]);
    console.log('Query result:', result);

    await client.query('COMMIT'); // Commit the transaction
    console.log('Transaction committed');

    return new Response(
      JSON.stringify({ success: true, message: 'FCM token registered successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error during transaction:', error);
    await client.query('ROLLBACK'); // Rollback the transaction in case of error
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    client.release(); // Release the client back to the pool
    console.log('Client released');
  }
}
  */


import express from 'express';
import pkg from 'pg'; // New
const { Pool } = pkg; // Destructure Pool
const router = express.Router();

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// POST /api/fcm-token
router.post('/fcm-token', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Starting transaction...');
    await client.query('BEGIN'); // Start transaction

    // Parse the request body
    const { email, role, fcmToken } = req.body;
    console.log('Request body:', { email, role, fcmToken });

    if (!email || !role || !fcmToken) {
      console.error('Missing required fields');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Update the FCM token in the database based on the role
    let query;
    switch (role) {
      case 'supervisor':
        query = 'UPDATE Supervisors SET fcm_token = $1 WHERE email = $2';
        break;
      case 'driver':
        query = 'UPDATE Drivers SET fcm_token = $1 WHERE email = $2';
        break;
      case 'storekeeper':
        query = 'UPDATE Storekeepers SET fcm_token = $1 WHERE email = $2';
        break;
      default:
        console.error('Invalid role:', role);
        return res.status(400).json({ success: false, error: `Invalid role: ${role}` });
    }

    console.log('Executing query:', query);
    const result = await client.query(query, [fcmToken, email]);
    console.log('Query result:', result);

    await client.query('COMMIT'); // Commit the transaction
    console.log('Transaction committed');

    return res.status(200).json({ success: true, message: 'FCM token registered successfully' });
  } catch (error) {
    console.error('Error during transaction:', error);
    await client.query('ROLLBACK'); // Rollback the transaction in case of error
    return res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release(); // Release the client back to the pool
    console.log('Client released');
  }
});

export default router;