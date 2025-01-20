import { fileURLToPath } from 'url'; // Add this import
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit'; // Import PDFKit
import pg from 'pg'; // Import the entire pg module
const { Pool } = pg; // Destructure Pool from the pg module
import mammoth from 'mammoth';

// Derive __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Generates a PDF from order data using PDFKit.
 * @param {Object} orderData - The order data to populate the template.
 * @param {string} filePath - The path to save the PDF (optional).
 * @returns {Promise<Buffer>} - Returns the PDF buffer for streaming.
 */
export async function generatePDF(orderData, filePath = null) {
  try {
    // Create a PDF document
    const doc = new PDFDocument();

    // If filePath is provided, pipe the PDF to a file
    if (filePath) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      doc.pipe(fs.createWriteStream(filePath));
    }

    // Add content to the PDF
    doc.fontSize(25).text(`Order ID: ${orderData.id}`, { align: 'center' });
    doc.moveDown();

    // Client Information
    doc.fontSize(16).text(`Client Name: ${orderData.client_name}`);
    doc.text(`Company Name: ${orderData.company_name}`);
    doc.text(`Phone Number: ${orderData.phone_number}`);
    doc.text(`Delivery Date: ${orderData.delivery_date}`);
    doc.moveDown();

    // Address Information
    doc.text(`Street: ${orderData.street}`);
    doc.text(`City: ${orderData.city}`);
    doc.text(`Region: ${orderData.region}`);
    doc.moveDown();

    // Products Table
    doc.fontSize(14).text('Products:', { underline: true });
    doc.moveDown();

    // Table Header
    doc.font('Helvetica-Bold').text('Description', 100, doc.y);
    doc.text('Quantity', 300, doc.y);
    doc.text('Price', 400, doc.y);
    doc.text('Total', 500, doc.y);
    doc.moveDown();

    // Table Rows
    doc.font('Helvetica');
    orderData.products.forEach((product) => {
      doc.text(product.description, 100, doc.y);
      doc.text(product.quantity.toString(), 300, doc.y);
      doc.text(`$${product.price}`, 400, doc.y);
      doc.text(`$${product.total_price}`, 500, doc.y);
      doc.moveDown();
    });

    // Finalize the PDF
    doc.end();

    // If filePath is not provided, return the PDF as a buffer
    if (!filePath) {
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (error) => reject(error));
      });
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Fetches order data from the database.
 * @param {string} orderId - The ID of the order.
 * @returns {Promise<Object>} - The order data.
 */
async function fetchOrderDataFromDatabase(orderId) {
  try {
    // Fetch order details
    const orderQuery = `
      SELECT o.*, c.company_name, c.client_name, c.phone_number, 
             c.tax_number, c.branch_number, c.latitude, c.longitude, 
             c.street, c.city, c.region, o.storekeeper_notes
      FROM orders o
      JOIN clients c ON o.client_id = c.id
      WHERE o.id = $1
    `;
    const orderResult = await pool.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    // Fetch products
    const productsQuery = `
      SELECT * FROM order_products
      WHERE order_id = $1
    `;
    const productsResult = await pool.query(productsQuery, [orderId]);

    return {
      ...orderResult.rows[0],
      products: productsResult.rows,
    };
  } catch (error) {
    console.error('Error fetching order data:', error);
    throw new Error('Failed to fetch order data');
  }
}

/**
 * Serves the PDF for a given order ID.
 * @param {string} orderId - The ID of the order.
 * @param {Object} res - The Express response object.
 */
export async function servePDF(orderId, res) {
  try {
    // Fetch order data from the database
    const orderData = await fetchOrderDataFromDatabase(orderId);

    // Generate the PDF
    const pdfBuffer = await generatePDF(orderData);

    // Set headers for mobile compatibility
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=order_${orderId}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send the PDF as a response
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF. Please try again later.' });
  }
}