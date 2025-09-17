// create_user.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User } = require("./models");

(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/forensivault");
  const username = process.argv[2] || "admin";
  const password = process.argv[3] || "123456";
  const role = process.argv[4] || "admin";

  const hashed = await bcrypt.hash(password, 10);
  const u = new User({ username, password: hashed, role });
  await u.save();
  console.log("Created user:", username);
  process.exit(0);
})();
