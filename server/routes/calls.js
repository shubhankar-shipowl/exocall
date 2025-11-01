const express = require('express');
const router = express.Router();
const {
  getCalls,
  createCall,
  getCallLogsByContact,
  deleteCallLog,
  setCallLogRemark,
} = require('../controllers/callController');

const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

router.get('/', getCalls);
router.post('/', createCall);
router.get('/contact/:contactId', getCallLogsByContact);
router.put('/:id/remark', setCallLogRemark);
router.delete('/:callLogId', deleteCallLog);

module.exports = router;
