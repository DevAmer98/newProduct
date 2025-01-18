/*import { Pool } from 'pg';
import admin from 'firebase-admin'; // Ensure Firebase Admin is initialized


// Firebase Admin Initialization (if not already initialized)
if (admin.apps.length === 0) {
  const serviceAccount = require("../../../secrets/new-product-28188-firebase-adminsdk-519rh-4906ca32b7.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  try {
    const res = await pool.query('SELECT 1 AS test');
    console.log('Database connection successful:', res.rows);
  } catch (error) {
    console.error('Database connection error:', error);
  }
}

testConnection();

// Function to send notifications to storekeepers
async function sendNotificationToStorekeeper(message, title = 'Notification') {
  const client = await pool.connect();
  try {
    // Fetch FCM tokens for storekeepers
    const query = 'SELECT fcm_token FROM Storekeepers WHERE role = $1 AND active = TRUE';
    const result = await client.query(query, ['storekeeper']);
    const tokens = result.rows.map(row => row.fcm_token).filter(token => token != null);

    console.log(`Sending notifications to storekeepers:`, tokens);

    // Check if tokens array is empty
    if (tokens.length === 0) {
      console.warn('No FCM tokens found for storekeepers. Skipping notification.');
      return;
    }

    // Prepare the messages for Firebase
    const messages = tokens.map(token => ({
      notification: {
        title: title,
        body: message
      },
      data: {
        role: 'storekeeper' // Add role information to the payload
      },
      token
    }));

    // Send the notifications
    const response = await admin.messaging().sendEach(messages);
    console.log('Successfully sent messages:', response);
    return response;
  } catch (error) {
    console.error('Failed to send FCM messages:', error);
    throw error;
  } finally {
    client.release();
  }
}



export async function PUT(request: Request) {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
  
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing order ID" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  
    try {
      const updateOrderQuery = `
        UPDATE orders 
        SET supervisoraccept = 'accepted',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await pool.query(updateOrderQuery, [id]);
  
      await sendNotificationToStorekeeper(
        `Order ${id} has been accepted by the supervisor.`,
        'Supervisor Accepted Order'
      );
  
      return new Response(
        JSON.stringify({ message: "Order accepted successfully" }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Internal Server Error", details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }*/

    /*
    import pkg from 'pg'; // New
    const { Pool } = pkg; // Destructure Pool
    import express from 'express';
    import admin from '../../firebase-init.js';
const router = express.Router();


// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
async function testConnection() {
  try {
    const res = await pool.query('SELECT 1 AS test');
    console.log('Database connection successful:', res.rows);
  } catch (error) {
    console.error('Database connection error:', error);
  }
}

testConnection();

// Function to send notifications to storekeepers
async function sendNotificationToStorekeeper(message, title = 'Notification') {
  const client = await pool.connect();
  try {
    // Fetch FCM tokens for storekeepers
    const query = 'SELECT fcm_token FROM Storekeepers WHERE role = $1 AND active = TRUE';
    const result = await client.query(query, ['storekeeper']);
    const tokens = result.rows.map((row) => row.fcm_token).filter((token) => token != null);

    console.log(`Sending notifications to storekeepers:`, tokens);

    // Check if tokens array is empty
    if (tokens.length === 0) {
      console.warn('No FCM tokens found for storekeepers. Skipping notification.');
      return;
    }

    // Prepare the messages for Firebase
    const messages = tokens.map((token) => ({
      notification: {
        title: title,
        body: message,
      },
      data: {
        role: 'storekeeper', // Add role information to the payload
      },
      token,
    }));

    // Send the notifications
    const response = await admin.messaging().sendEach(messages);
    console.log('Successfully sent messages:', response);
    return response;
  } catch (error) {
    console.error('Failed to send FCM messages:', error);
    throw error;
  } finally {
    client.release();
  }
}

// PUT /api/orders/:id/accept-supervisor
router.put('/acceptSupervisor/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing order ID' });
  }

  try {
    const updateOrderQuery = `
      UPDATE orders 
      SET supervisoraccept = 'accepted',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await pool.query(updateOrderQuery, [id]);

    await sendNotificationToStorekeeper(
      `تم قبول الطلب رقم ${id} من قبل المشرف.`,
      'المشرف قبل الطلب'
    );


    return res.status(200).json({ message: 'Order accepted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;

*/


import pkg from 'pg'; // New
const { Pool } = pkg; // Destructure Pool
import express from 'express';
import admin from '../../firebase-init.js';
const router = express.Router();

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Utility function to retry database operations
const executeWithRetry = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Utility function to add timeout to database queries
const withTimeout = (promise, timeout) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Database query timed out')), timeout)
  );
  return Promise.race([promise, timeoutPromise]);
};

// Test database connection
async function testConnection() {
  try {
    const res = await executeWithRetry(async () => {
      return await withTimeout(pool.query('SELECT 1 AS test'), 5000); // 5-second timeout
    });
    console.log('Database connection successful:', res.rows);
  } catch (error) {
    console.error('Database connection error:', error);
  }
}

testConnection();

// Function to send notifications to storekeepers
async function sendNotificationToStorekeeper(message, title = 'Notification') {
  const client = await pool.connect();
  try {
    // Fetch FCM tokens for storekeepers
    const query = 'SELECT fcm_token FROM Storekeepers WHERE role = $1 AND active = TRUE';
    const result = await executeWithRetry(async () => {
      return await withTimeout(client.query(query, ['storekeeper']), 10000); // 10-second timeout
    });
    const tokens = result.rows.map((row) => row.fcm_token).filter((token) => token != null);

    console.log(`Sending notifications to storekeepers:`, tokens);

    // Check if tokens array is empty
    if (tokens.length === 0) {
      console.warn('No FCM tokens found for storekeepers. Skipping notification.');
      return;
    }

    // Prepare the messages for Firebase
    const messages = tokens.map((token) => ({
      notification: {
        title: title,
        body: message,
      },
      data: {
        role: 'storekeeper', // Add role information to the payload
      },
      token,
    }));

    // Send the notifications
    const response = await admin.messaging().sendEach(messages);
    console.log('Successfully sent messages:', response);
    return response;
  } catch (error) {
    console.error('Failed to send FCM messages:', error);
    throw error;
  } finally {
    client.release();
  }
}

// PUT /api/orders/:id/accept-supervisor
router.put('/acceptSupervisor/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing order ID' });
  }

  try {
    const updateOrderQuery = `
      UPDATE orders 
      SET supervisoraccept = 'accepted',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await executeWithRetry(async () => {
      return await withTimeout(pool.query(updateOrderQuery, [id]), 10000); // 10-second timeout
    });

    await sendNotificationToStorekeeper(
      `تم قبول الطلب رقم ${id} من قبل المشرف.`,
      'المشرف قبل الطلب'
    );

    return res.status(200).json({ message: 'Order accepted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;