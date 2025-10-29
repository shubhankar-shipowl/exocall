const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const CallLog = sequelize.define(
  "CallLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    contact_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "contacts",
        key: "id",
      },
    },
    exotel_call_sid: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Exotel Call SID for tracking",
    },
    attempt_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    recording_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Duration in seconds",
    },
  },
  {
    tableName: "call_logs",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

module.exports = CallLog;
