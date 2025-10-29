const Contact = require("./models/Contact");
const CallLog = require("./models/CallLog");
const Settings = require("./models/Settings");
const User = require("./models/User");

// Define associations
Contact.hasMany(CallLog, {
  foreignKey: "contact_id",
  as: "callLogs",
});

CallLog.belongsTo(Contact, {
  foreignKey: "contact_id",
  as: "contact",
});

module.exports = {
  Contact,
  CallLog,
  Settings,
  User,
};
