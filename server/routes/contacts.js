const express = require('express');
const router = express.Router();
const {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  initiateCall,
  addNote,
  setStatusOverride,
  setRemark,
} = require('../controllers/contactController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Public routes (both admin and agent can access)
router.get('/', getContacts);
router.get('/:id', getContactById);
router.post('/:id/call', initiateCall);
router.post('/:id/note', addNote);
router.put('/:id/status-override', setStatusOverride);
router.put('/:id/remark', setRemark);

// Admin-only routes
router.post('/', authorize(['admin']), createContact);
router.put('/:id', authorize(['admin']), updateContact);
router.delete('/:id', authorize(['admin']), deleteContact);

module.exports = router;
