const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Settings = sequelize.define(
  "Settings",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null for global settings (admin)
      references: {
        model: "users",
        key: "id",
      },
    },
    exotel_sid: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    api_key: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    api_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    agent_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    caller_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "settings",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    indexes: [
      {
        fields: ["user_id"],
      },
    ],
  }
);

module.exports = Settings;
