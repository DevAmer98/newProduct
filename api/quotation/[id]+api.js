
import express from 'express';
import pkg from 'pg'; // Import the default export
const { Pool } = pkg; // Destructure Pool from the default export
import admin from '../../firebase-init.js';

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
router.get('/quotations/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing quotation ID' });
  }

  try {
    // Fetch quotation details
    const quotationQuery = `
      SELECT q.*, c.company_name, c.client_name, c.phone_number, 
             c.tax_number, c.branch_number, c.latitude, c.longitude, 
             c.street, c.city, c.region, q.storekeeper_notes
      FROM quotations q
      JOIN clients c ON q.client_id = c.id
      WHERE q.id = $1
    `;

    const quotationResult = await executeWithRetry(async () => {
      return await withTimeout(pool.query(quotationQuery, [id]), 10000); // 10-second timeout
    });

    if (quotationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Fetch products
    const productsQuery = `
      SELECT * FROM quotation_products
      WHERE quotation_id = $1
    `;
    const productsResult = await executeWithRetry(async () => {
      return await withTimeout(pool.query(productsQuery, [id]), 10000); // 10-second timeout
    });

    // Fetch sales representative
    const salesRepQuery = `
      SELECT name, email, phone FROM salesreps
      WHERE id = $1
    `;
    const salesRepResult = await executeWithRetry(async () => {
      return await withTimeout(pool.query(salesRepQuery, [quotationResult.rows[0].sales_rep_id]), 10000); // 10-second timeout
    });

    // Combine all data into the response
    const orderData = {
      ...quotationResult.rows[0],
      products: productsResult.rows,
      salesRep: salesRepResult.rows[0] || null, // Include salesRep data
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
/*
router.put('/quotations/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing quotation ID' });
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
    const actualDeliveryDate = status === 'delivered' ? new Date().toISOString() : null;

    const updateQuoatationQuery = `
      UPDATE quotations 
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
        pool.query(updateQuoatationQuery, [
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
      const deleteProductsQuery = `DELETE FROM quotation_products WHERE quotation_id = $1`;
      await executeWithRetry(async () => {
        return await withTimeout(pool.query(deleteProductsQuery, [id]), 10000); // 10-second timeout
      });

      for (const product of products) {
        const { section, type, quantity, description,price } = product;
        await executeWithRetry(async () => {
          return await withTimeout(
            pool.query(
              `INSERT INTO quotation_products (quotation_id, section, type, description, quantity,price) 
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [id, section, type, description, quantity, price]
            ),
            10000 // 10-second timeout
          );
        });
      }
    }

    return res.status(200).json({ message: 'Quotation and products updated successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});
*/



router.put('/quotations/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing quotation ID' });
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
    } = body;

    // Set `actual_delivery_date` if the status is "delivered"
    const actualDeliveryDate = status === 'delivered' ? new Date().toISOString() : null;

    // Calculate totals based on products
    let totalPrice = 0;
    let totalVat = 0;
    let totalSubtotal = 0;

    if (products && products.length > 0) {
      for (const product of products) {
        const { price, quantity } = product;
        const numericPrice = parseFloat(price) || 0;
        const numericQuantity = parseFloat(quantity) || 0;

        const totalPriceForProduct = numericPrice * numericQuantity; // Total price for the quantity
        const vat = totalPriceForProduct * 0.15; // VAT is 15% of the total price for the quantity
        const subtotal = totalPriceForProduct + vat; // Subtotal is total price + VAT

        totalPrice += totalPriceForProduct;
        totalVat += vat;
        totalSubtotal += subtotal;
      }
    }

    // Update the quotation with the new totals
    const updateQuotationQuery = `
      UPDATE quotations 
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
          total_price = $10,
          total_vat = $11,
          total_subtotal = $12
      WHERE id = $13
    `;

    await executeWithRetry(async () => {
      return await withTimeout(
        pool.query(updateQuotationQuery, [
          client_id,
          delivery_date,
          delivery_type,
          notes || null,
          status,
          storekeeperaccept,
          supervisoraccept,
          actualDeliveryDate,
          body.storekeeper_notes || null,
          totalPrice,
          totalVat,
          totalSubtotal,
          id,
        ]),
        10000 // 10-second timeout
      );
    });

    // Update products if provided
    if (products && products.length > 0) {
      const deleteProductsQuery = `DELETE FROM quotation_products WHERE quotation_id = $1`;
      await executeWithRetry(async () => {
        return await withTimeout(pool.query(deleteProductsQuery, [id]), 10000); // 10-second timeout
      });

      for (const product of products) {
        const { section, type, quantity, description, price } = product;

        // Calculate VAT and subtotal for each product
        const numericPrice = parseFloat(price) || 0;
        const numericQuantity = parseFloat(quantity) || 0;

        const totalPriceForProduct = numericPrice * numericQuantity; // Total price for the quantity
        const vat = totalPriceForProduct * 0.15; // VAT is 15% of the total price for the quantity
        const subtotal = totalPriceForProduct + vat; // Subtotal is total price + VAT

        await executeWithRetry(async () => {
          return await withTimeout(
            pool.query(
              `INSERT INTO quotation_products (quotation_id, section, type, description, quantity, price, vat, subtotal) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [id, section, type, description, quantity, price, vat, subtotal]
            ),
            10000 // 10-second timeout
          );
        });
      }
    }

    return res.status(200).json({ message: 'Quotation and products updated successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});
// DELETE /api/orders/:id
router.delete('/quotations/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing quotation ID' });
  }

  try {
    const deleteProductsQuery = `DELETE FROM quotation_products WHERE quotation_id = $1`;
    await executeWithRetry(async () => {
      return await withTimeout(pool.query(deleteProductsQuery, [id]), 10000); // 10-second timeout
    });

    const deleteOrderQuery = `DELETE FROM quotations WHERE id = $1`;
    const deleteOrderResult = await executeWithRetry(async () => {
      return await withTimeout(pool.query(deleteOrderQuery, [id]), 10000); // 10-second timeout
    });

    if (deleteOrderResult.rowCount === 0) {
      return res.status(404).json({ error: 'Quotations not found' });
    }

    return res.status(200).json({ message: 'Quotation and associated products deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;