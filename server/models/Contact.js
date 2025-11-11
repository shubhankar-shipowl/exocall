const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Contact = sequelize.define(
  'Contact',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    schedule_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        'Not Called',
        'In Progress',
        'Completed',
        'Failed',
        'Busy',
        'No Answer',
        'Switched Off',
        'Cancelled',
      ),
      allowNull: false,
      defaultValue: 'Not Called',
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    exotel_call_sid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    recording_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration in seconds',
    },
    agent_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    product_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    price: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Product price/value',
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'State from Consignee State column',
    },
    store: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    last_attempt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    remark: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Remark: accept or reject',
    },
  },
  {
    tableName: 'contacts',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    underscored: false,
    freezeTableName: true,
  },
);

module.exports = Contact;
