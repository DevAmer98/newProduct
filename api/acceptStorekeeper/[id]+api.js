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



// Function to send notifications to drivers
async function sendNotificationToDriver(message, title = 'Notification') {
  const client = await pool.connect();
  try {
    // Fetch FCM tokens for drivers
    const query = 'SELECT fcm_token FROM Drivers WHERE role = $1 AND active = TRUE';
    const result = await client.query(query, ['driver']);
    const tokens = result.rows.map(row => row.fcm_token).filter(token => token != null);

    console.log(`Sending notifications to drivers:`, tokens);

    // Check if tokens array is empty
    if (tokens.length === 0) {
      console.warn('No FCM tokens found for drivers. Skipping notification.');
      return;
    }

    // Prepare the messages for Firebase
    const messages = tokens.map(token => ({
      notification: {
        title: title,
        body: message
      },
      data: {
        role: 'driver' // Add role information to the payload
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
        SET storekeeperaccept = 'accepted',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await pool.query(updateOrderQuery, [id]);
  
      await sendNotificationToDriver(
        `تم قبول الطلب ${id} من قبل أمين المخزن.`,
        'الطلب جاهز للتوصيل'
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


    import express from 'express';
import admin from 'firebase-admin'; // Ensure Firebase Admin is initialized
import pkg from 'pg'; // New
const { Pool } = pkg; // Destructure Pool

const router = express.Router();

// Firebase Admin Initialization (if not already initialized)
if (admin.apps.length === 0) {
  const serviceAccount = require('../../../secrets/new-product-28188-firebase-adminsdk-519rh-4906ca32b7.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

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

// Function to send notifications to drivers
async function sendNotificationToDriver(message, title = 'Notification') {
  const client = await pool.connect();
  try {
    // Fetch FCM tokens for drivers
    const query = 'SELECT fcm_token FROM Drivers WHERE role = $1 AND active = TRUE';
    const result = await client.query(query, ['driver']);
    const tokens = result.rows.map((row) => row.fcm_token).filter((token) => token != null);

    console.log(`Sending notifications to drivers:`, tokens);

    // Check if tokens array is empty
    if (tokens.length === 0) {
      console.warn('No FCM tokens found for drivers. Skipping notification.');
      return;
    }

    // Prepare the messages for Firebase
    const messages = tokens.map((token) => ({
      notification: {
        title: title,
        body: message,
      },
      data: {
        role: 'driver', // Add role information to the payload
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

router.put('/acceptStorekeeper/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing order ID' });
  }

  try {
    const updateOrderQuery = `
      UPDATE orders 
      SET storekeeperaccept = 'accepted',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await pool.query(updateOrderQuery, [id]);

    await sendNotificationToDriver(
      `تم قبول الطلب ${id} من قبل أمين المخزن.`,
      'الطلب جاهز للتوصيل'
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