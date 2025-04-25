
import express from 'express';
import pkg from 'pg'; // Import the default export
const { Pool } = pkg; // Destructure Pool from the default export

const router = express.Router();

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, 
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

// GET /api/orders/:id
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing order ID' });
  }

  try {
    const orderQuery = `
      SELECT o.*, c.company_name, c.client_name, c.phone_number, 
             c.tax_number, c.branch_number, c.latitude, c.longitude, 
             c.street, c.city, c.region, o.storekeeper_notes
      FROM orders o
      JOIN clients c ON o.client_id = c.id
      WHERE o.id = $1
    `;

    const orderResult = await executeWithRetry(async () => {
      return await withTimeout(pool.query(orderQuery, [id]), 10000); // 10-second timeout
    });

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const productsQuery = `
      SELECT * FROM order_products
      WHERE order_id = $1
    `;
    const productsResult = await executeWithRetry(async () => {
      return await withTimeout(pool.query(productsQuery, [id]), 10000); // 10-second timeout
    });

    const orderData = {
      ...orderResult.rows[0],
      products: productsResult.rows,
    };

    return res.status(200).json(orderData);
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

// PUT /api/orders/:id
router.put('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing order ID' });
  }

  try {
    const {
      client_id,
      delivery_date,
      delivery_type,
      notes,
      products,
      status = 'not Delivered',
      storekeeperaccept = 'pending',
      supervisoraccept = 'pending',
      total_price,
    } = body;

    // Set `actual_delivery_date` if the status is "delivered"
    const actualDeliveryDate = actual_delivery_date || (status?.toLowerCase() === 'delivered' ? new Date().toISOString() : null);



    const updateOrderQuery = `
      UPDATE orders 
      SET client_id = $1,
          delivery_date = $2,
          delivery_type = $3,
          notes = $4,
          status = $5,
          storekeeperaccept = $6,
          supervisoraccept = $7,
          updated_at = CURRENT_TIMESTAMP,
          actual_delivery_date = COALESCE($8, actual_delivery_date),
          storekeeper_notes = $9,
          total_price = $10
      WHERE id = $11
    `;

    await executeWithRetry(async () => {
      return await withTimeout(
        pool.query(updateOrderQuery, [
          client_id,
          delivery_date,
          delivery_type,
          notes || null,
          status, 
          storekeeperaccept,
          supervisoraccept,
          actualDeliveryDate,
          body.storekeeper_notes || null,
          total_price,
          id,
        ]),
        10000 // 10-second timeout
      );
    });

    if (products && products.length > 0) {
      const deleteProductsQuery = `DELETE FROM order_products WHERE order_id = $1`;
      await executeWithRetry(async () => {
        return await withTimeout(pool.query(deleteProductsQuery, [id]), 10000); // 10-second timeout
      });

      for (const product of products) {
        const { section, type, quantity, description,price } = product;
        await executeWithRetry(async () => {
          return await withTimeout(
            pool.query(
              `INSERT INTO order_products (order_id, section, type, description, quantity,price) 
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [id, section, type, description, quantity, price]
            ),
            10000 // 10-second timeout
          );
        });
      }
    }

    return res.status(200).json({ message: 'Order and products updated successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

// DELETE /api/orders/:id
router.delete('/orders/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing order ID' });
  }

  try {
    const deleteProductsQuery = `DELETE FROM order_products WHERE order_id = $1`;
    await executeWithRetry(async () => {
      return await withTimeout(pool.query(deleteProductsQuery, [id]), 10000); // 10-second timeout
    });

    const deleteOrderQuery = `DELETE FROM orders WHERE id = $1`;
    const deleteOrderResult = await executeWithRetry(async () => {
      return await withTimeout(pool.query(deleteOrderQuery, [id]), 10000); // 10-second timeout
    });

    if (deleteOrderResult.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({ message: 'Order and associated products deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;