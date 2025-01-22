/*import express from 'express';
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
router.post('/quotations/salesRep', async (req, res) => {
  const client = await pool.connect();
  try {
    await executeWithRetry(async () => {
      await client.query('BEGIN'); // Start transaction

      const {
        client_id,
        username,
        delivery_date,
        delivery_type,
        products,
        notes,
        status = 'not Delivered',
      } = req.body;

      // Validate required fields
      if (!client_id || !username || !delivery_date || !delivery_type || !products || products.length === 0) {
        await client.query('ROLLBACK'); // Rollback if validation fails
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Format delivery date
      const formattedDate = moment(delivery_date).tz('UTC').format('YYYY-MM-DD HH:mm:ss');

      // Insert quotation
      const quotationResult = await withTimeout(
        client.query(
          `INSERT INTO quotations (client_id, username, delivery_date, delivery_type, notes, status, total_price, total_vat, total_subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [client_id, username, formattedDate, delivery_type, notes || null, status, 0, 0, 0]
        ),
        10000 // 10-second timeout
      );

      const quotationId = quotationResult.rows[0].id;
      let totalPrice = 0;
      let totalVat = 0;
      let totalSubtotal = 0;

      // Insert products and calculate VAT and subtotal for each row
      for (const product of products) {
        const { section, type, description, quantity, price } = product;

        // Validate product fields
        if (!section || !type || !quantity || !price) {
          await client.query('ROLLBACK'); // Rollback if product validation fails
          return res.status(400).json({ error: 'Missing product details or price' });
        }

        const numericPrice = parseFloat(price);
        if (isNaN(numericPrice)) {
          await client.query('ROLLBACK'); // Rollback if price is invalid
          return res.status(400).json({ error: 'Invalid price format' });
        }

        // Calculate VAT and subtotal for the current product row
        const vat = numericPrice * 0.15; // VAT is 15% of the product price
        const subtotal = numericPrice + vat; // Subtotal is price + VAT

        // Update totals for the entire quotation
        totalPrice += numericPrice * quantity;
        totalVat += vat * quantity;
        totalSubtotal += subtotal * quantity;

        // Insert the product row with VAT and subtotal
        await client.query(
          `INSERT INTO quotation_products (quotation_id, section, type, description, quantity, price, vat, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [quotationId, section, type, description, quantity, numericPrice, vat, subtotal]
        );
      }

      // Update the quotation with the total price, total VAT, and total subtotal
      await client.query(
        `UPDATE quotations 
         SET total_price = $1, 
             total_vat = $2, 
             total_subtotal = $3 
         WHERE id = $4`,
        [totalPrice, totalVat, totalSubtotal, quotationId]
      );

      await client.query('COMMIT'); // Commit transaction

      // Send notifications to supervisors
      await sendNotificationToSupervisor(`تم إنشاء عرض سعر جديد بالمعرف ${quotationId} وينتظر موافقتك.`, 'إشعار عرض سعر جديد');

      return res.status(201).json({
        quotationId,
        status: 'success',
        totalPrice,
        totalVat,
        totalSubtotal,
      });
    });
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback on any error
    console.error('Error creating quotation:', error);
    return res.status(500).json({ error: error.message || 'Error creating quotation' });
  } finally {
    client.release(); // Release the client back to the pool
  }
});



// GET endpoint to fetch orders
router.get('/quotations/salesRep', async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const query = req.query.query || '';
    const username = req.query.username || '';

    const offset = (page - 1) * limit;

    const baseQuery = `
      SELECT 
        quotations.*, 
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
        quotations.status,
        quotations.storekeeperaccept,
        quotations.actual_delivery_date,
        quotations.total_price,
        quotations.total_vat,
        quotations.total_subtotal
      FROM quotations
      JOIN clients ON quotations.client_id = clients.id
      WHERE quotations.username = $4 AND 
            (clients.client_name ILIKE $3 OR clients.company_name ILIKE $3)
      ORDER BY quotations.delivery_date DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM quotations
      JOIN clients ON quotations.client_id = clients.id
      WHERE quotations.username = $2 AND 
            (clients.client_name ILIKE $1 OR clients.company_name ILIKE $1)
    `;

    const baseQueryParams = [limit, offset, `%${query}%`, username];
    const countQueryParams = [`%${query}%`, username];

    const [quotationsResult, countResult] = await executeWithRetry(async () => {
      return await Promise.all([
        withTimeout(client.query(baseQuery, baseQueryParams), 10000), // 10-second timeout
        withTimeout(client.query(countQuery, countQueryParams), 10000), // 10-second timeout
      ]);
    });

    const orders = quotationsResult.rows;
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
    console.error('Error fetching quotations:', error);
    return res.status(500).json({
      error: error.message || 'Error fetching quotations',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});

export default router;

*/

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
     FROM quotations 
     WHERE custom_id LIKE $1`,
    [`NPQ-${year}-%`]
  );
  const lastId = result.rows[0].last_id || 0;
  const newId = `NPQ-${year}-${String(lastId + 1).padStart(5, '0')}`;
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

// POST endpoint to create a quotation
router.post('/quotations/salesRep', async (req, res) => {
  const client = await pool.connect();
  try {
    await executeWithRetry(async () => {
      await client.query('BEGIN'); // Start transaction

      const {
        client_id,
        username,
        delivery_date,
        delivery_type,
        products,
        notes,
        status = 'not Delivered',
      } = req.body;

      // Validate required fields
      if (!client_id || !username || !delivery_date || !delivery_type || !products || products.length === 0) {
        await client.query('ROLLBACK'); // Rollback if validation fails
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Format delivery date
      const formattedDate = moment(delivery_date).tz('UTC').format('YYYY-MM-DD HH:mm:ss');

      // Generate custom ID
      const customId = await generateCustomId(client);

      // Insert quotation
      const quotationResult = await withTimeout(
        client.query(
          `INSERT INTO quotations (client_id, username, delivery_date, delivery_type, notes, status, total_price, total_vat, total_subtotal, custom_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [client_id, username, formattedDate, delivery_type, notes || null, status, 0, 0, 0, customId]
        ),
        10000 // 10-second timeout
      );

      const quotationId = quotationResult.rows[0].id;
      let totalPrice = 0;
      let totalVat = 0;
      let totalSubtotal = 0;

      // Insert products and calculate VAT and subtotal for each row
      for (const product of products) {
        const { section, type, description, quantity, price } = product;

        // Validate product fields
        if (!section || !type || !quantity || !price) {
          await client.query('ROLLBACK'); // Rollback if product validation fails
          return res.status(400).json({ error: 'Missing product details or price' });
        }

        const numericPrice = parseFloat(price);
        if (isNaN(numericPrice)) {
          await client.query('ROLLBACK'); // Rollback if price is invalid
          return res.status(400).json({ error: 'Invalid price format' });
        }

        // Calculate VAT and subtotal for the current product row
        const vat = numericPrice * 0.15; // VAT is 15% of the product price
        const subtotal = numericPrice + vat; // Subtotal is price + VAT

        // Update totals for the entire quotation
        totalPrice += numericPrice * quantity;
        totalVat += vat * quantity;
        totalSubtotal += subtotal * quantity;

        // Insert the product row with VAT and subtotal
        await client.query(
          `INSERT INTO quotation_products (quotation_id, section, type, description, quantity, price, vat, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [quotationId, section, type, description, quantity, numericPrice, vat, subtotal]
        );
      }

      // Update the quotation with the total price, total VAT, and total subtotal
      await client.query(
        `UPDATE quotations 
         SET total_price = $1, 
             total_vat = $2, 
             total_subtotal = $3 
         WHERE id = $4`,
        [totalPrice, totalVat, totalSubtotal, quotationId]
      );

      await client.query('COMMIT'); // Commit transaction

      // Send notifications to supervisors
      await sendNotificationToSupervisor(`تم إنشاء عرض سعر جديد بالمعرف ${customId} وينتظر موافقتك.`, 'إشعار عرض سعر جديد');

      return res.status(201).json({
        quotationId,
        customId,
        status: 'success',
        totalPrice,
        totalVat,
        totalSubtotal,
      });
    });
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback on any error
    console.error('Error creating quotation:', error);
    return res.status(500).json({ error: error.message || 'Error creating quotation' });
  } finally {
    client.release(); // Release the client back to the pool
  }
});

// GET endpoint to fetch orders
router.get('/quotations/salesRep', async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const query = req.query.query || '';
    const username = req.query.username || '';

    const offset = (page - 1) * limit;

    const baseQuery = `
      SELECT 
        quotations.*, 
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
        quotations.status,
        quotations.storekeeperaccept,
        quotations.actual_delivery_date,
        quotations.total_price,
        quotations.total_vat,
        quotations.total_subtotal
      FROM quotations
      JOIN clients ON quotations.client_id = clients.id
      WHERE quotations.username = $4 AND 
            (clients.client_name ILIKE $3 OR clients.company_name ILIKE $3)
      ORDER BY quotations.delivery_date DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM quotations
      JOIN clients ON quotations.client_id = clients.id
      WHERE quotations.username = $2 AND 
            (clients.client_name ILIKE $1 OR clients.company_name ILIKE $1)
    `;

    const baseQueryParams = [limit, offset, `%${query}%`, username];
    const countQueryParams = [`%${query}%`, username];

    const [quotationsResult, countResult] = await executeWithRetry(async () => {
      return await Promise.all([
        withTimeout(client.query(baseQuery, baseQueryParams), 10000), // 10-second timeout
        withTimeout(client.query(countQuery, countQueryParams), 10000), // 10-second timeout
      ]);
    });

    const orders = quotationsResult.rows;
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
    console.error('Error fetching quotations:', error);
    return res.status(500).json({
      error: error.message || 'Error fetching quotations',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});

export default router;