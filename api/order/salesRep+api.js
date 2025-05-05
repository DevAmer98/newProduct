import express from 'express';
import moment from 'moment-timezone'; // Ensure moment-timezone is installed
import admin from '../../firebase-init.js';
import pkg from 'pg'; // New
const { Pool } = pkg; // Destructure Pool

const router = express.Router();

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased timeout
});

router.use(express.json()); // Middleware to parse JSON bodies

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

// Function to generate custom ID
const generateCustomId = async (client) => {
  const year = new Date().getFullYear();
  const result = await client.query(
    `SELECT MAX(SUBSTRING(custom_id FROM 10)::int) AS last_id 
     FROM orders 
     WHERE custom_id LIKE $1`,
    [`NPO-${year}-%`]
  );
  const lastId = result.rows[0].last_id || 0;
  const newId = `NPO-${year}-${String(lastId + 1).padStart(5, '0')}`;
  return newId;
};

// Function to send notifications to supervisors
async function sendNotificationToSupervisor(message, title = 'Notification') {
  const client = await pool.connect();
  try {
    // Fetch FCM tokens for supervisors
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
router.post('/orders/salesRep', async (req, res) => {
  const client = await pool.connect();
  try {
    // Improved executeWithRetry function implementation
    const result = await executeWithRetry(async () => {
      try {
        await client.query('BEGIN');
        const { client_id, username, delivery_date, delivery_type, products, notes, status = 'not Delivered' } = req.body;

        if (!client_id || !delivery_date || !delivery_type || !products || products.length === 0) {
          throw new Error('Missing required fields');
        }

        let formattedDate = moment(delivery_date).tz('UTC').format('YYYY-MM-DD HH:mm:ss');

        // Generate custom ID
        const customId = await generateCustomId(client);

        const orderResult = await withTimeout(
          client.query(
            `INSERT INTO orders (client_id, username, delivery_date, delivery_type, notes, status, total_price, total_vat, total_subtotal, custom_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [client_id, username, formattedDate, delivery_type, notes || null, status, 0, 0, 0, customId]
          ),
          10000 // 10-second timeout
        );
        const orderId = orderResult.rows[0].id;

        let totalPrice = 0, totalVat = 0, totalSubtotal = 0;
        for (const product of products) {
          const { section, type, description, quantity, price } = product;
          if (!section || !type || !quantity || !price) {
            throw new Error('Missing product details or price');
          }
          const numericPrice = parseFloat(price);
          if (isNaN(numericPrice)) { throw new Error('Invalid price format'); }
          const vat = numericPrice * 0.15;
          const subtotal = numericPrice + vat;
          totalPrice += numericPrice * quantity;
          totalVat += vat * quantity;
          totalSubtotal += subtotal * quantity;
          await client.query(
            `INSERT INTO order_products (order_id, section, type, description, quantity, price, vat, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [orderId, product.section, product.type, product.description, product.quantity, numericPrice, vat, subtotal]
          );
        }

        await client.query(`UPDATE orders SET total_price = $1, total_vat = $2, total_subtotal = $3 WHERE id = $4`, 
          [totalPrice, totalVat, totalSubtotal, orderId]);
        await client.query('COMMIT');

        return {
          orderId, 
          customId, 
          status: 'success',
          totalPrice,
          totalVat,
          totalSubtotal
        };
      } catch (err) {
        // Make sure we rollback on any error within this function
        await client.query('ROLLBACK');
        throw err; // Re-throw to be handled by executeWithRetry
      }
    });
    
    // If we get here, the transaction succeeded
    // Send notifications to supervisors
    await sendNotificationToSupervisor(`تم إنشاء طلب جديد بالمعرف ${result.customId} وينتظر موافقتك.`, 'إشعار طلب جديد');
    
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(400).json({ error: error.message || 'Error creating order' });
  } finally {
    client.release();
  }
});

// Improved executeWithRetry function (just a suggestion, implement according to your needs)
async function executeWithRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Attempt ${attempt} failed: ${error.message}`);
      lastError = error;
      
      // Only retry on specific errors, e.g., connection issues
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Helper function to determine if an error is retryable
function isRetryableError(error) {
  // Define which errors should trigger a retry
  // For example, connection timeouts, but not validation errors
  const retryableCodes = ['08006', '08001', '08004', '57P01']; 
  return retryableCodes.includes(error.code);
}

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
        orders.total_vat,
        orders.total_subtotal 
      FROM orders
      JOIN clients ON orders.client_id = clients.id
      WHERE orders.username = $4 AND 
            (clients.client_name ILIKE $3 OR clients.company_name ILIKE $3)
      ORDER BY orders.created_at DESC
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

    const [ordersResult, countResult] = await executeWithRetry(async () => {
      return await Promise.all([
        withTimeout(client.query(baseQuery, baseQueryParams), 10000), // 10-second timeout
        withTimeout(client.query(countQuery, countQueryParams), 10000), // 10-second timeout
      ]);
    });

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