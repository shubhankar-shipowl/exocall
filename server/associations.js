const Contact = require('./models/Contact');
const CallLog = require('./models/CallLog');
const Settings = require('./models/Settings');
const User = require('./models/User');

// Define associations only if they haven't been defined yet
// This prevents duplicate association errors when module is reloaded
if (!Contact.associations.callLogs) {
  Contact.hasMany(CallLog, {
    foreignKey: 'contact_id',
    as: 'callLogs',
  });
}

if (!CallLog.associations.contact) {
  CallLog.belongsTo(Contact, {
    foreignKey: 'contact_id',
    as: 'contact',
  });
}

module.exports = {
  Contact,
  CallLog,
  Settings,
  User,
};
