/*import express from 'express';
import cors from 'cors';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { Pool } from 'pg';
import mammoth from 'mammoth';

// Initialize Express app
const app = express();
app.use(express.json());

// Enable CORS for all routes
app.use(cors({
  origin: '*', // Allow all origins (replace with your app's domain in production)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Generates a PDF from a DOCX template using order data.
 * @param {Object} orderData - The order data to populate the template.
 * @param {string} filePath - The path to save the PDF (optional).
 * @returns {Promise<Buffer>} - Returns the PDF buffer for streaming.
 *//*
export async function generatePDF(orderData, filePath = null) {
  try {
    // Load the DOCX template
    const templatePath = path.join(__dirname, '..', 'templates', 'Quotation.docx');
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Populate the template with order data
    doc.setData({
      client_id: orderData.client_id,
      username: orderData.username,
      delivery_date: orderData.delivery_date,
      delivery_type: orderData.delivery_type,
      notes: orderData.notes,
      status: orderData.status,
      supervisoraccept: orderData.supervisoraccept,
      storekeeperaccept: orderData.storekeeperaccept,
      client_name: orderData.client_name,
      client_phone: orderData.phone_number,
      client_street: orderData.street,
      client_city: orderData.city,
      client_region: orderData.region,
      products: orderData.products.map(product => ({
        section: product.section,
        type: product.type,
        description: product.description,
        quantity: product.quantity,
        price: product.price,
        total_price: product.total_price,
      })),
    });

    // Render the document
    doc.render();

    // Generate the DOCX file
    const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' });

    // Convert DOCX to PDF using Puppeteer
    const pdfBuffer = await convertDocxToPdf(docxBuffer);

    // Save the PDF to a file (if filePath is provided)
    if (filePath) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, pdfBuffer);
    }

    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Converts a DOCX buffer to a PDF buffer using Puppeteer.
 * @param {Buffer} docxBuffer - The DOCX file buffer.
 * @returns {Promise<Buffer>} - The PDF file buffer.
 *//*
async function convertDocxToPdf(docxBuffer) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // Convert DOCX to HTML using mammoth
  const { value: htmlContent } = await mammoth.extractRawText({ buffer: docxBuffer });

  await page.setContent(htmlContent);
  const pdfBuffer = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();

  return pdfBuffer;
}

/**
 * Fetches order data from the database.
 * @param {string} orderId - The ID of the order.
 * @returns {Promise<Object>} - The order data.
 *//*
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
 *//*
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

// Endpoint to serve PDFs
app.get('/api/order/pdf/:orderId', async (req, res) => {
  const { orderId } = req.params;
  await servePDF(orderId, res);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Try accessing: http://localhost:${PORT}/api/order/pdf/123`); // Replace 123 with a valid order ID
});

// Shutdown handler to close the database pool
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});*/

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { Pool } from 'pg'; // Import the PostgreSQL pool
import mammoth from 'mammoth';

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Generates a PDF from a DOCX template using order data.
 * @param {Object} orderData - The order data to populate the template.
 * @param {string} filePath - The path to save the PDF (optional).
 * @returns {Promise<Buffer>} - Returns the PDF buffer for streaming.
 */
export async function generatePDF(orderData, filePath = null) {
  try {
    // Load the DOCX template
    const templatePath = path.join(__dirname, '..', 'templates', 'Quotation.docx'); // Path to the DOCX template
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Populate the template with order data
    doc.setData({
      client_id: orderData.client_id,
      username: orderData.username,
      delivery_date: orderData.delivery_date,
      delivery_type: orderData.delivery_type,
      notes: orderData.notes,
      status: orderData.status,
      supervisoraccept: orderData.supervisoraccept,
      storekeeperaccept: orderData.storekeeperaccept,
      client_name: orderData.client_name,
      client_phone: orderData.phone_number,
      client_street: orderData.street,
      client_city: orderData.city,
      client_region: orderData.region,
      products: orderData.products.map(product => ({
        section: product.section,
        type: product.type,
        description: product.description,
        quantity: product.quantity,
        price: product.price,
        total_price: product.total_price,
      })),
    });

    // Render the document
    doc.render();

    // Generate the DOCX file
    const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' });

    // Convert DOCX to PDF using Puppeteer
    const pdfBuffer = await convertDocxToPdf(docxBuffer);

    // Save the PDF to a file (if filePath is provided)
    if (filePath) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, pdfBuffer);
    }

    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Converts a DOCX buffer to a PDF buffer using Puppeteer.
 * @param {Buffer} docxBuffer - The DOCX file buffer.
 * @returns {Promise<Buffer>} - The PDF file buffer.
 */
async function convertDocxToPdf(docxBuffer) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // Convert DOCX to HTML using mammoth
  const { value: htmlContent } = await mammoth.extractRawText({ buffer: docxBuffer });

  await page.setContent(htmlContent);
  const pdfBuffer = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();

  return pdfBuffer;
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