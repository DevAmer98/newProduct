import PDFDocument from 'pdfkit';
import fs from 'fs';

export function generatePDF(orderData, filePath) {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  // Helper function to handle null/undefined values
  const getValue = (value) => (value !== null && value !== undefined ? value : 'N/A');

  // Add content to the PDF
  doc.fontSize(25).text('Order Details', { underline: true });
  doc.moveDown();

  // Order Information
  doc.fontSize(14).text(`Order ID: ${getValue(orderData.id)}`);
  doc.text(`Client Name: ${getValue(orderData.client_name)}`);
  doc.text(`Company Name: ${getValue(orderData.company_name)}`);
  doc.text(`Phone Number: ${getValue(orderData.phone_number)}`);
  doc.text(`Tax Number: ${getValue(orderData.tax_number)}`);
  doc.text(`Branch Number: ${getValue(orderData.branch_number)}`);
  doc.text(`Delivery Date: ${getValue(orderData.delivery_date)}`);
  doc.text(`Delivery Type: ${getValue(orderData.delivery_type)}`);
  doc.text(`Status: ${getValue(orderData.status)}`);
  doc.text(`Storekeeper Notes: ${getValue(orderData.storekeeper_notes)}`);
  doc.moveDown();

  // Client Address
  doc.text('Client Address:', { underline: true });
  doc.text(`Street: ${getValue(orderData.street)}`);
  doc.text(`City: ${getValue(orderData.city)}`);
  doc.text(`Region: ${getValue(orderData.region)}`);
  doc.text(`Latitude: ${getValue(orderData.latitude)}`);
  doc.text(`Longitude: ${getValue(orderData.longitude)}`);
  doc.moveDown();

  // Products
  doc.text('Products:', { underline: true });
  orderData.products.forEach((product, index) => {
    doc.text(`Product ${index + 1}:`);
    doc.text(`- Section: ${getValue(product.section)}`);
    doc.text(`- Type: ${getValue(product.type)}`);
    doc.text(`- Description: ${getValue(product.description)}`);
    doc.text(`- Quantity: ${getValue(product.quantity)}`);
    doc.moveDown();
  });

  // Finalize the PDF
  doc.end();
}
// GET /api/orders/:id/pdf
router.get('/orders/:id/pdf', async (req, res) => {
    const { id } = req.params;
  
    if (!id) {
      return res.status(400).json({ error: 'Missing order ID' });
    }
  
    try {
      // Fetch order data
      const orderQuery = `
        SELECT o.*, c.company_name, c.client_name, c.phone_number, 
               c.tax_number, c.branch_number, c.latitude, c.longitude, 
               c.street, c.city, c.region, o.storekeeper_notes
        FROM orders o
        JOIN clients c ON o.client_id = c.id
        WHERE o.id = $1
      `;
      const orderResult = await pool.query(orderQuery, [id]);
  
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
  
      // Fetch products
      const productsQuery = `
        SELECT * FROM order_products
        WHERE order_id = $1
      `;
      const productsResult = await pool.query(productsQuery, [id]);
  
      const orderData = {
        ...orderResult.rows[0],
        products: productsResult.rows,
      };
  
      // Generate PDF
      const pdfPath = `order_${id}.pdf`;
      await new Promise((resolve, reject) => {
        generatePDF(orderData, pdfPath);
        const stream = fs.createWriteStream(pdfPath);
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
  
      // Send the PDF as a response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=order_${id}.pdf`);
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);
  
      // Delete the file after sending
      fileStream.on('end', () => {
        fs.unlinkSync(pdfPath);
      });
  
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
    }
  });