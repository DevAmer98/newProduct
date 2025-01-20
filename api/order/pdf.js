import { fileURLToPath } from 'url'; // Add this import
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit'; // Import PDFKit
import pg from 'pg'; // Import the entire pg module
const { Pool } = pg; // Destructure Pool from the pg module
import mammoth from 'mammoth';
import libre from 'libreoffice-convert'; // For .docx to PDF conversion


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


/**
 * Generates a PDF from a .docx template using docxtemplater and libreoffice-convert.
 * @param {Object} orderData - The order data to populate the template.
 * @param {string} templatePath - The path to the .docx template file.
 * @param {string} filePath - The path to save the PDF (optional).
 * @returns {Promise<Buffer>} - Returns the PDF buffer for streaming.
 */
export async function generatePDF(orderData, templatePath, filePath = null) {
  try {
    // Step 1: Load the .docx template
    const templateContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(templateContent);

    // Step 2: Initialize Docxtemplater with the PizZip instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Step 3: Populate the template with data
    doc.setData(orderData);

    // Step 4: Render the document (replace all placeholders with data)
    try {
      doc.render();
    } catch (error) {
      console.error('Error rendering template:', error);
      throw new Error(`Failed to render template: ${error.message}`);
    }

    // Step 5: Generate the .docx buffer
    const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' });

    // Step 6: Convert the .docx buffer to a PDF
    const pdfBuffer = await convertDocxToPDF(docxBuffer);

    // If filePath is provided, save the PDF file
    if (filePath) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, pdfBuffer);
    }

    // Return the PDF buffer
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Converts a .docx buffer to a PDF buffer using libreoffice-convert.
 * @param {Buffer} docxBuffer - The .docx file as a buffer.
 * @returns {Promise<Buffer>} - The PDF file as a buffer.
 */
async function convertDocxToPDF(docxBuffer) {
  return new Promise((resolve, reject) => {
    libre.convert(docxBuffer, '.pdf', undefined, (err, pdfBuffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(pdfBuffer);
      }
    });
  });
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

    const salesRepQuery = `
    SELECT name, email, phone FROM salesreps
    WHERE id = $1
  `;
  const salesRepResult = await pool.query(salesRepQuery, [orderResult.rows[0].sales_rep_id]);

    return {
      ...orderResult.rows[0],
      products: productsResult.rows,
      salesRep: salesRepResult.rows[0] || {}, // Include sales representative data

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
    const templatePath = path.resolve(__dirname, '../../templates/Quotation.docx');
    const pdfBuffer = await generatePDF(orderData, templatePath);

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