const express = require("express");
const router = express.Router();
const {
  getCalls,
  createCall,
  getCallLogsByContact,
  deleteCallLog,
} = require("../controllers/callController");

router.get("/", getCalls);
router.post("/", createCall);
router.get("/contact/:contactId", getCallLogsByContact);
router.delete("/:callLogId", deleteCallLog);

module.exports = router;
