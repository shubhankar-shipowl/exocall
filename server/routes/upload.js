const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const Contact = require("../models/Contact");
const { sequelize } = require("../config/database");
const { authenticate, authorize } = require("../middleware/auth");
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed!"), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Ensure uploads directory exists
const fs = require("fs");
const path = require("path");
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Upload endpoint - Admin only
router.post(
  "/",
  authenticate,
  authorize(["admin"]),
  upload.single("excelFile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log("Processing file:", req.file.filename);

      // Get upload date from request (if provided)
      const uploadDate = req.body.uploadDate || new Date();
      console.log("Upload date:", uploadDate);

      // Read and parse Excel file
      const workbook = XLSX.readFile(req.file.path);

      // Use the first sheet (index 0) since user confirmed only one sheet
      const sheetName = workbook.SheetNames[0];
      console.log(`Using sheet: ${sheetName}`);

      if (!sheetName) {
        return res.status(400).json({
          error: "No sheets found in Excel file",
          availableSheets: workbook.SheetNames,
        });
      }

      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        return res.status(400).json({
          error: "Invalid sheet selected",
          availableSheets: workbook.SheetNames,
        });
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log(`Found ${jsonData.length} rows in Excel file`);

      // Debug: Log available columns from the first row
      if (jsonData.length > 0) {
        console.log("Available columns:", Object.keys(jsonData[0]));
      }

      if (jsonData.length === 0) {
        return res.status(400).json({ error: "Excel file is empty" });
      }

      // Helper function to find column value case-insensitively
      const getColumnValue = (row, possibleNames) => {
        const rowKeys = Object.keys(row);
        for (const possibleName of possibleNames) {
          // Try exact match first
          if (row[possibleName] !== undefined) {
            return row[possibleName];
          }
          // Try case-insensitive match
          const foundKey = rowKeys.find(
            (key) => key.toLowerCase() === possibleName.toLowerCase()
          );
          if (foundKey) {
            return row[foundKey];
          }
        }
        return null;
      };

      // Map Excel columns to our contact fields
      const contacts = [];
      const errors = [];
      // Removed duplicate tracking - allow all records to be uploaded

      jsonData.forEach((row, index) => {
        try {
          // Extract fields based on the actual Excel structure from Call confirmation sheet
          // Use case-insensitive matching for all columns
          const name = getColumnValue(row, ["Consignee Name *", "Consignee Name"]);
          const contactNo = getColumnValue(row, ["Consignee Mobile *", "Consignee Mobile"]);
          const productName = getColumnValue(row, ["Product Name *", "Product Name"]);
          const quantity = getColumnValue(row, ["Product Qty *", "Product Qty"]);
          const price = getColumnValue(row, ["Product Value *", "Product VALUE *", "Product Value", "Product VALUE"]);
          const orderNumber = getColumnValue(row, ["Order Number *", "Order Number"]);
          const address1 = getColumnValue(row, ["Consignee Address 1 *", "Consignee Address 1"]);
          const address2 = getColumnValue(row, ["Consignee Address 2 *", "Consignee Address 2"]) || null;
          const pincode = getColumnValue(row, ["Pincode *", "Pincode"]);
          const state = getColumnValue(row, ["Consignee State", "Consignee STATE", "State"]) || null;
          const remark = getColumnValue(row, ["REMARK", "Remark", "remark"]) || null;
          const store = getColumnValue(row, ["Store", "store", "STORE"]) || null;

          // Combine address 1 and 2
          const address = [address1, address2]
            .filter((addr) => addr && addr.toString().trim())
            .join(", ");

          // Debug: Log first few rows to see what's being extracted
          if (index < 3) {
            console.log(`Row ${index + 2} data:`, {
              name,
              contactNo,
              productName,
              quantity,
              price,
              orderNumber,
              remark,
            });
          }

          // Validate required fields
          if (!name || !contactNo) {
            errors.push(
              `Row ${index + 2}: Missing required fields (Name: ${
                name || "empty"
              }, Contact No: ${contactNo || "empty"})`
            );
            return;
          }

          // Create message from available data
          let message = `Order: ${orderNumber || "N/A"}`;
          if (productName) message += ` | Product: ${productName}`;
          if (quantity) message += ` | Qty: ${quantity}`;
          if (price) message += ` | Value: ₹${price}`;
          if (address) message += ` | Address: ${address}`;
          if (pincode) message += ` | Pincode: ${pincode}`;

          // Clean phone number - remove spaces, special characters, and ensure it's a string
          const cleanPhone = contactNo
            .toString()
            .replace(/[^\d+]/g, "")
            .trim();

          // Validate phone number length (should be at least 7 digits)
          if (cleanPhone.length < 7) {
            errors.push(
              `Row ${
                index + 2
              }: Invalid phone number (too short): ${cleanPhone}`
            );
            return;
          }

          // Allow duplicate phone numbers - removed duplicate check

          // Create contact object
          const contact = {
            name: name.toString().trim(),
            phone: cleanPhone,
            message: message,
            schedule_time: null, // Can be set later
            status: "Not Called",
            attempts: 0,
            product_name: productName || null,
            price: price ? price.toString() : null,
            address: address || null,
            state: state ? state.toString().trim() : null,
            store: store ? store.toString().trim() : null,
            agent_notes: `Imported from Excel. Order: ${
              orderNumber || "N/A"
            }, Product: ${productName || "N/A"}, Qty: ${
              quantity || "N/A"
            }, Value: ₹${price || "N/A"}, Address: ${
              address || "N/A"
            }, Pincode: ${pincode || "N/A"}, State: ${
              state || "N/A"
            }, Store: ${
              store || "N/A"
            }, Remark: ${remark || "N/A"}`,
          };

          contacts.push(contact);
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
        }
      });

      if (contacts.length === 0) {
        return res.status(400).json({
          error: "No valid contacts found",
          details: errors,
        });
      }

      console.log(
        `Valid contacts: ${contacts.length}, Errors: ${errors.length}`
      );

      // Insert contacts into database in optimized batches
      console.log(
        `Attempting to insert ${contacts.length} contacts into database`
      );

      // Debug: Log first few contacts
      if (contacts.length > 0) {
        console.log("First contact sample:", contacts[0]);
      }

      const batchSize = 200; // Increased batch size for better performance
      const insertedContacts = [];
      let totalErrors = 0;

      console.log(
        `Starting batch processing with ${contacts.length} contacts in batches of ${batchSize}`
      );

      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        try {
          console.log(
            `Processing batch ${batchNumber} with ${batch.length} contacts`
          );
          // Use raw SQL INSERT with Sequelize - safer approach
          const now = uploadDate ? new Date(uploadDate) : new Date();

          // Insert one by one with proper escaping to avoid SQL injection
          for (const c of batch) {
            try {
              await sequelize.query(
                `
                INSERT INTO contacts 
                (name, phone, message, status, attempts, agent_notes, product_name, price, address, state, store, createdAt, updatedAt, last_attempt) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
                {
                  replacements: [
                    c.name || "",
                    c.phone || "",
                    c.message || null,
                    c.status || "Not Called",
                    c.attempts || 0,
                    c.agent_notes || null,
                    c.product_name || null,
                    c.price || null,
                    c.address || null,
                    c.state || null,
                    c.store || null,
                    now,
                    now,
                    null,
                  ],
                }
              );
            } catch (err) {
              console.error(
                "❌ Insert error for contact:",
                c.name,
                err.message
              );
            }
          }
          const batchResult = batch;
          insertedContacts.push(...batchResult);
          console.log(
            `✅ Batch ${batchNumber}: Inserted ${batchResult.length} contacts`
          );
        } catch (error) {
          console.error(`❌ Batch ${batchNumber} failed:`, error.message);
          console.error(`❌ Batch ${batchNumber} error details:`, error);

          // Try smaller batches for this batch
          const smallBatchSize = 50;
          for (let j = 0; j < batch.length; j += smallBatchSize) {
            const smallBatch = batch.slice(j, j + smallBatchSize);
            try {
              // Use raw SQL for small batches with proper escaping
              const now = uploadDate ? new Date(uploadDate) : new Date();
              for (const c of smallBatch) {
                try {
                  await sequelize.query(
                    `
                    INSERT INTO contacts 
                    (name, phone, message, status, attempts, agent_notes, product_name, price, address, state, store, createdAt, updatedAt, last_attempt) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `,
                    {
                      replacements: [
                        c.name || "",
                        c.phone || "",
                        c.message || null,
                        c.status || "Not Called",
                        c.attempts || 0,
                        c.agent_notes || null,
                        c.product_name || null,
                        c.price || null,
                        c.address || null,
                        c.state || null,
                        c.store || null,
                        now,
                        now,
                        null,
                      ],
                    }
                  );
                } catch (err) {
                  // Skip individual errors
                }
              }
              const smallBatchResult = smallBatch;
              insertedContacts.push(...smallBatchResult);
              console.log(
                `  ✅ Sub-batch: Inserted ${smallBatchResult.length} contacts`
              );
            } catch (smallError) {
              console.error(`  ❌ Sub-batch failed:`, smallError.message);
              // Skip individual insertion for performance - just count errors
              totalErrors += smallBatch.length;
            }
          }
        }
      }

      console.log(
        `✅ Successfully inserted ${insertedContacts.length} contacts out of ${contacts.length}`
      );
      if (totalErrors > 0) {
        console.log(`⚠️  ${totalErrors} contacts were skipped due to errors`);
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Successfully imported ${insertedContacts.length} contacts`,
        totalRows: jsonData.length,
        validContacts: contacts.length,
        insertedContacts: insertedContacts.length,
        errors: errors.slice(0, 10), // Limit errors to first 10
        errorsCount: errors.length,
      });
    } catch (error) {
      console.error("Upload error:", error);
      console.error("Error stack:", error.stack);

      // Clean up file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error("Error deleting file:", unlinkError);
        }
      }

      res.status(500).json({
        error: "Failed to process Excel file",
        details: error.message,
        type: error.name,
      });
    }
  }
);

// Get upload statistics
router.get("/stats", authenticate, async (req, res) => {
  try {
    console.log("📊 GET /api/upload/stats - Starting");

    // Use raw SQL to get counts - avoids Sequelize model issues
    const [totalResult] = await sequelize.query(
      "SELECT COUNT(*) as count FROM contacts"
    );
    const totalContacts = totalResult[0].count;

    // Get recent contacts (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const [recentResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM contacts 
      WHERE createdAt >= '${yesterday}'
    `);
    const recentContacts = recentResult[0].count;

    console.log(`📊 Stats: Total=${totalContacts}, Recent=${recentContacts}`);

    res.json({
      totalContacts,
      recentContacts,
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete all contacts (clear uploaded data)
router.delete("/clear", async (req, res) => {
  try {
    const { confirm } = req.body;

    if (!confirm) {
      return res.status(400).json({
        error: "Confirmation required",
        message: "Please confirm deletion by sending { confirm: true }",
      });
    }

    // Get count before deletion using raw SQL
    const { sequelize } = require("../config/database");
    const [countResult] = await sequelize.query(
      "SELECT COUNT(*) as count FROM contacts"
    );
    const totalContacts = countResult[0].count;

    console.log(`Found ${totalContacts} contacts to delete`);

    if (totalContacts === 0) {
      return res.json({
        success: true,
        message: "No contacts to delete",
        deletedCount: 0,
      });
    }

    // Delete all contacts using raw SQL (handles foreign key constraints)
    // First delete call logs that reference these contacts
    await sequelize.query("DELETE FROM call_logs");

    // Then delete all contacts
    await sequelize.query("DELETE FROM contacts");

    res.json({
      success: true,
      message: `Successfully deleted ${totalContacts} contacts`,
      deletedCount: totalContacts,
    });
  } catch (error) {
    console.error("Delete contacts error:", error);
    res.status(500).json({
      error: "Failed to delete contacts",
      details: error.message,
    });
  }
});

// Delete contacts by date range
router.delete("/clear-by-date", async (req, res) => {
  try {
    const { startDate, endDate, confirm } = req.body;

    if (!confirm) {
      return res.status(400).json({
        error: "Confirmation required",
        message: "Please confirm deletion by sending { confirm: true }",
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "Date range required",
        message: "Please provide startDate and endDate",
      });
    }

    const whereClause = {
      createdAt: {
        [require("sequelize").Op.between]: [
          new Date(startDate),
          new Date(endDate),
        ],
      },
    };

    // Get count before deletion using raw SQL
    const { sequelize } = require("../config/database");
    const startDateStr = new Date(startDate)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const endDateStr = new Date(endDate)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM contacts 
      WHERE createdAt BETWEEN '${startDateStr}' AND '${endDateStr}'
    `);
    const contactsCount = countResult[0].count;

    if (contactsCount === 0) {
      return res.json({
        success: true,
        message: "No contacts found in the specified date range",
        deletedCount: 0,
      });
    }

    // Delete contacts in the date range using raw SQL
    // First delete call logs that reference these contacts
    await sequelize.query(`
      DELETE FROM call_logs 
      WHERE contact_id IN (
        SELECT id FROM contacts 
        WHERE createdAt BETWEEN '${startDateStr}' AND '${endDateStr}'
      )
    `);

    // Then delete the contacts
    await sequelize.query(`
      DELETE FROM contacts 
      WHERE createdAt BETWEEN '${startDateStr}' AND '${endDateStr}'
    `);

    res.json({
      success: true,
      message: `Successfully deleted ${contactsCount} contacts from ${startDate} to ${endDate}`,
      deletedCount: contactsCount,
    });
  } catch (error) {
    console.error("Delete contacts by date error:", error);
    res.status(500).json({
      error: "Failed to delete contacts",
      details: error.message,
    });
  }
});

module.exports = router;
