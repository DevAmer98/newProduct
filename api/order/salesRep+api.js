/*import { Pool } from 'pg';
import moment from 'moment-timezone'; // Ensure moment-timezone is installed
import admin from 'firebase-admin';

// Firebase Admin Initialization (if not already initialized)
if (admin.apps.length === 0) {
  const serviceAccount = require("../../../secrets/new-product-28188-firebase-adminsdk-519rh-4906ca32b7.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});




async function sendNotificationToSupervisor(message, title = 'Notification') {
  const client = await pool.connect();
  try {
    // Fetch FCM tokens for supervisors
    const query = 'SELECT fcm_token FROM Supervisors WHERE role = $1 AND active = TRUE';
    const result = await client.query(query, ['supervisor']);
    const tokens = result.rows.map(row => row.fcm_token).filter(token => token != null);

    console.log(`Sending notifications to supervisors:`, tokens);

    // Prepare the messages for Firebase
    const messages = tokens.map(token => ({
      notification: {
        title: title,
        body: message
      },
      data: {
        role: 'supervisor' // Add role information to the payload
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





export async function POST(request) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { client_id, username, delivery_date, delivery_type, products, notes, status = "not Delivered" } = await request.json();

    if (!client_id || !delivery_date || !delivery_type || !products || products.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let formattedDate = moment(delivery_date).tz('UTC').format('YYYY-MM-DD HH:mm:ss');
    const orderResult = await client.query(
      `INSERT INTO orders (client_id, username, delivery_date, delivery_type, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [client_id, username, formattedDate, delivery_type, notes || null, status]
    );
    const orderId = orderResult.rows[0].id;

    let totalPrice = 0;
    for (const product of products) {
      totalPrice += parseFloat(product.price);
      await client.query(
        `INSERT INTO order_products (order_id, section, type, description, quantity, price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, product.section, product.type, product.description, product.quantity, parseFloat(product.price)]
      );
    }

    await client.query(`UPDATE orders SET total_price = $1 WHERE id = $2`, [totalPrice, orderId]);
    await client.query('COMMIT');

    // Send notifications to supervisors
    await sendNotificationToSupervisor(`New order with ID ${orderId} has been created and awaits your approval.`, 'New Order Notification');

    return new Response(JSON.stringify({ orderId, status: 'success', totalPrice }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    return new Response(JSON.stringify({ error: error.message || "Error creating order" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  } finally {
    client.release();
  }
}



export async function GET(request: Request) {
  const client = await pool.connect();

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50);
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
    const query = url.searchParams.get("query") || "";
    const username = url.searchParams.get("username") || ""; 

    const offset = (page - 1) * limit;

    const baseQuery = `
      SELECT 
        orders.*, 
        clients.client_name AS client_name,
        clients.phone_number AS client_phone,
        clients.company_name AS client_company,
        clients.branch_number AS client_branch,
        clients.tax_number AS client_tax,
        clients.latitude AS client_latitude,
        clients.longitude AS client_longitude,
        clients.street AS client_street,
        clients.city AS client_city,
        clients.region AS client_region, 
        orders.status,
        orders.storekeeperaccept,
        orders.actual_delivery_date,
        orders.total_price 
      FROM orders
      JOIN clients ON orders.client_id = clients.id
      WHERE orders.username = $4 AND 
            (clients.client_name ILIKE $3 OR clients.company_name ILIKE $3)
      ORDER BY orders.delivery_date DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM orders
      JOIN clients ON orders.client_id = clients.id
      WHERE orders.username = $2 AND 
            (clients.client_name ILIKE $1 OR clients.company_name ILIKE $1)
    `;

    const baseQueryParams = [limit, offset, `%${query}%`, username];
    const countQueryParams = [`%${query}%`, username];

    const [ordersResult, countResult] = await Promise.all([
      client.query(baseQuery, baseQueryParams),
      client.query(countQuery, countQueryParams),
    ]);

    const orders = ordersResult.rows;
    const totalCount = parseInt(countResult.rows[0]?.total || 0, 10);
    const hasMore = page * limit < totalCount;

    return new Response(
      JSON.stringify({
        orders,
        hasMore,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch ( error) {
    console.error("Error fetching orders:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error fetching orders",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  } finally {
    client.release();
  }
}
*/

import express from 'express';
import moment from 'moment-timezone'; // Ensure moment-timezone is installed
import admin from 'firebase-admin';
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

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});



router.use(express.json()); // Middleware to parse JSON bodies

async function sendNotificationToSupervisor(message, title = 'Notification') {
    const client = await pool.connect();
    try {
      // Fetch FCM tokens for storekeepers
      const query = 'SELECT fcm_token FROM Supervisors WHERE role = $1 AND active = TRUE';
      const result = await client.query(query, ['supervisor']);
      const tokens = result.rows.map((row) => row.fcm_token).filter((token) => token != null);
  
      console.log(`Sending notifications to supervisor:`, tokens);
  
      // Check if tokens array is empty
      if (tokens.length === 0) {
        console.warn('No FCM tokens found for supervisors. Skipping notification.');
        return;
      }
  
      // Prepare the messages for Firebase
      const messages = tokens.map((token) => ({
        notification: {
          title: title,
          body: message,
        },
        data: {
          role: 'supervisor', // Add role information to the payload
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


// POST endpoint to create an order
router.post('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { client_id, username, delivery_date, delivery_type, products, notes, status = 'not Delivered' } = req.body;

    if (!client_id || !delivery_date || !delivery_type || !products || products.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let formattedDate = moment(delivery_date).tz('UTC').format('YYYY-MM-DD HH:mm:ss');
    const orderResult = await client.query(
      `INSERT INTO orders (client_id, username, delivery_date, delivery_type, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [client_id, username, formattedDate, delivery_type, notes || null, status]
    );
    const orderId = orderResult.rows[0].id;

    let totalPrice = 0;
    for (const product of products) {
      totalPrice += parseFloat(product.price);
      await client.query(
        `INSERT INTO order_products (order_id, section, type, description, quantity, price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, product.section, product.type, product.description, product.quantity, parseFloat(product.price)]
      );
    }

    await client.query(`UPDATE orders SET total_price = $1 WHERE id = $2`, [totalPrice, orderId]);
    await client.query('COMMIT'); 

    // Send notifications to supervisors
    await sendNotificationToSupervisor(`تم إنشاء طلب جديد بالمعرف ${orderId} وينتظر موافقتك.`, 'إشعار طلب جديد');


    return res.status(201).json({ orderId, status: 'success', totalPrice });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    return res.status(500).json({ error: error.message || 'Error creating order' });
  } finally {
    client.release();
  }
});

// GET endpoint to fetch orders
router.get('/orders/salesRep', async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const query = req.query.query || '';
    const username = req.query.username || '';

    const offset = (page - 1) * limit;

    const baseQuery = `
      SELECT 
        orders.*, 
        clients.client_name AS client_name,
        clients.phone_number AS client_phone,
        clients.company_name AS client_company,
        clients.branch_number AS client_branch,
        clients.tax_number AS client_tax,
        clients.latitude AS client_latitude,
        clients.longitude AS client_longitude,
        clients.street AS client_street,
        clients.city AS client_city,
        clients.region AS client_region, 
        orders.status,
        orders.storekeeperaccept,
        orders.actual_delivery_date,
        orders.total_price 
      FROM orders
      JOIN clients ON orders.client_id = clients.id
      WHERE orders.username = $4 AND 
            (clients.client_name ILIKE $3 OR clients.company_name ILIKE $3)
      ORDER BY orders.delivery_date DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM orders
      JOIN clients ON orders.client_id = clients.id
      WHERE orders.username = $2 AND 
            (clients.client_name ILIKE $1 OR clients.company_name ILIKE $1)
    `;

    const baseQueryParams = [limit, offset, `%${query}%`, username];
    const countQueryParams = [`%${query}%`, username];

    const [ordersResult, countResult] = await Promise.all([
      client.query(baseQuery, baseQueryParams),
      client.query(countQuery, countQueryParams),
    ]);

    const orders = ordersResult.rows;
    const totalCount = parseInt(countResult.rows[0]?.total || 0, 10);
    const hasMore = page * limit < totalCount;

    return res.status(200).json({
      orders,
      hasMore,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      error: error.message || 'Error fetching orders',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});



export default router;
